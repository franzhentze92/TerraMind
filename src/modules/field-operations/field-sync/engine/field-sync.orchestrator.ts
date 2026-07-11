import { randomUUID } from 'node:crypto'

import type { SyncTransport } from '@/modules/field-operations/field-sync/api/field-sync-transport'
import {
  MAX_SYNC_ATTEMPTS,
  PROCESSING_POLL_MAX,
  PROCESSING_POLL_MS,
  computeRetryDelay,
  mapLocalEvidenceType,
} from '@/modules/field-operations/field-sync/config/fire-field-sync.config'
import { buildConflict } from '@/modules/field-operations/field-sync/engine/field-sync-conflicts'
import { evaluateSyncEligibility } from '@/modules/field-operations/field-sync/engine/field-sync-eligibility'
import {
  assetKey,
  bundleRegistrationKey,
  observationKey,
  requirementLinkKey,
  submissionKey,
  uploadSessionKey,
} from '@/modules/field-operations/field-sync/engine/field-sync-idempotency'
import { evaluateReconciliation } from '@/modules/field-operations/field-sync/engine/field-sync-reconciliation'
import {
  mergeUploadProgress,
  uploadAssetResumable,
} from '@/modules/field-operations/field-sync/engine/field-sync-resumable-upload'
import { FieldSyncRepository } from '@/modules/field-operations/field-sync/field-sync.repository'
import type {
  AssetUploadSession,
  SyncOperation,
  SyncSession,
} from '@/modules/field-operations/field-sync/field-sync.types'
import type { LocalEvidenceBundle, LocalEvidenceRecord } from '@/modules/field-operations/offline-evidence/offline-evidence.types'
import { OfflineEvidenceRepository } from '@/modules/field-operations/offline-evidence/offline-evidence.repository'
import type { LocalOfflinePackageRecord } from '@/modules/field-operations/offline-packages/offline-package.repository'

function nowIso() {
  return new Date().toISOString()
}

function observationFieldsFromRecord(record: LocalEvidenceRecord): Record<string, unknown> {
  const payload = record.structured_payload ?? {}
  const answers = (payload.answers as Record<string, unknown>) ?? payload
  return { ...answers, observer_notes: answers.observer_notes ?? answers.notes ?? '' }
}

async function updateSession(repo: FieldSyncRepository, session: SyncSession, patch: Partial<SyncSession>) {
  const next = { ...session, ...patch, updated_at: nowIso() }
  await repo.saveSession(next)
  return next
}

export async function syncBundle(input: {
  bundle: LocalEvidenceBundle
  pkg: LocalOfflinePackageRecord
  evidenceRepo: OfflineEvidenceRepository
  syncRepo: FieldSyncRepository
  transport: SyncTransport
  tab_id: string
  permissions?: string[]
  mission_status?: string | null
}): Promise<{ ok: boolean; session?: SyncSession; reason?: string }> {
  const eligibility = evaluateSyncEligibility({
    bundle: input.bundle,
    pkg: input.pkg,
    mission_status: input.mission_status,
    permissions: input.permissions ?? ['evidence.submit'],
    now_iso: nowIso(),
  })
  if (!eligibility.eligible) {
    return { ok: false, reason: eligibility.reasons.join(',') }
  }

  let session = await input.syncRepo.getSessionByBundle(input.bundle.bundle_id, input.bundle.bundle_checksum)
  if (session?.status === 'syncing' && session.tab_id && session.tab_id !== input.tab_id) {
    return { ok: false, reason: 'sync_tab_conflict' }
  }

  const ts = nowIso()
  if (!session) {
    session = {
      session_id: input.syncRepo.newId('sync'),
      bundle_id: input.bundle.bundle_id,
      bundle_checksum: input.bundle.bundle_checksum,
      package_id: input.bundle.package_id,
      package_version: input.bundle.package_version,
      mission_id: input.bundle.mission_id,
      task_id: input.bundle.task_id,
      status: 'sync_queued',
      tab_id: input.tab_id,
      attempt: 0,
      max_attempts: MAX_SYNC_ATTEMPTS,
      next_retry_at: null,
      last_error: null,
      error_classification: null,
      bytes_total: input.bundle.size_bytes,
      bytes_transferred: 0,
      created_at: ts,
      updated_at: ts,
      started_at: null,
      completed_at: null,
      paused: false,
      cancelled: false,
    }
    await input.syncRepo.saveSession(session)
  }

  if (session.paused || session.cancelled) {
    return { ok: false, reason: session.cancelled ? 'sync_cancelled' : 'sync_paused' }
  }

  session = await updateSession(input.syncRepo, session, {
    status: 'syncing',
    started_at: session.started_at ?? ts,
    attempt: session.attempt + 1,
  })

  try {
    const mission = await input.transport.getMissionStatus(input.bundle.mission_id)
    if (mission.cancelled) {
      await recordConflict(input.syncRepo, session, buildConflict({
        conflict_type: 'mission_cancelled',
        message: 'Misión cancelada remotamente',
      }))
      session = await updateSession(input.syncRepo, session, { status: 'conflict' })
      return { ok: false, reason: 'mission_cancelled', session }
    }

    const pkgRemote = await input.transport.getPackageRemoteStatus(input.bundle.package_id)
    if (pkgRemote.revoked) {
      await recordConflict(input.syncRepo, session, buildConflict({
        conflict_type: 'package_revoked',
        message: 'Paquete revocado — evidencia local conservada',
      }))
      session = await updateSession(input.syncRepo, session, { status: 'sync_blocked' })
      return { ok: false, reason: 'package_revoked', session }
    }

    await input.transport.registerBundle({
      bundle_id: input.bundle.bundle_id,
      bundle_checksum: input.bundle.bundle_checksum,
      mission_id: input.bundle.mission_id,
      package_id: input.bundle.package_id,
      package_version: input.bundle.package_version,
      task_id: input.bundle.task_id,
      idempotency_key: bundleRegistrationKey(input.bundle.bundle_id, input.bundle.bundle_checksum),
    })

    const records = (
      await Promise.all(input.bundle.evidence_record_ids.map((id) => input.evidenceRepo.getRecord(id)))
    ).filter(Boolean) as LocalEvidenceRecord[]

    const remoteSubmissionIds: string[] = []
    let bytesTransferred = session.bytes_transferred

    for (const record of records) {
      const submissionId = await syncRecord({
        record,
        bundle: input.bundle,
        session,
        evidenceRepo: input.evidenceRepo,
        syncRepo: input.syncRepo,
        transport: input.transport,
        onBytes: (n) => {
          bytesTransferred += n
        },
      })
      remoteSubmissionIds.push(submissionId)
      session = await updateSession(input.syncRepo, session, { bytes_transferred: bytesTransferred })
    }

    const snapshots = await Promise.all(
      remoteSubmissionIds.map((id) => input.transport.getSubmissionReconciliation(id)),
    )

    const reconciliation = evaluateReconciliation({
      bundle_id: input.bundle.bundle_id,
      bundle_checksum: input.bundle.bundle_checksum,
      expected_record_count: records.length,
      submissions: snapshots,
    })

    if (!reconciliation.ok) {
      session = await updateSession(input.syncRepo, session, {
        status: 'partially_synced',
        last_error: reconciliation.reasons.join(','),
      })
      return { ok: false, reason: 'reconciliation_failed', session }
    }

    for (let i = 0; i < records.length; i++) {
      const record = records[i]!
      const submissionId = remoteSubmissionIds[i]!
      await input.syncRepo.saveMapping({
        mapping_id: input.syncRepo.newId('map'),
        bundle_id: input.bundle.bundle_id,
        bundle_checksum: input.bundle.bundle_checksum,
        local_evidence_id: record.local_evidence_id,
        local_asset_id: null,
        remote_submission_id: submissionId,
        remote_asset_id: snapshots[i]?.assets[0]?.id ?? null,
        remote_observation_id: snapshots[i]?.has_observation ? submissionId : null,
        synced_at: ts,
        remote_state: snapshots[i]?.status ?? null,
        reconciliation_checksum: reconciliation.reconciliation_checksum,
        created_at: ts,
        updated_at: ts,
      })
    }

    const syncedBundle: LocalEvidenceBundle = {
      ...input.bundle,
      status: 'synced' as never,
      updated_at: ts,
    }
    await input.evidenceRepo.saveBundle(syncedBundle)

    session = await updateSession(input.syncRepo, session, {
      status: 'synced',
      completed_at: ts,
      last_error: null,
    })

    return { ok: true, session }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'sync_failed'
    session = await updateSession(input.syncRepo, session, {
      status: session.attempt >= session.max_attempts ? 'remote_rejected' : 'retry_scheduled',
      last_error: message,
      next_retry_at: new Date(Date.now() + computeRetryDelay(session.attempt)).toISOString(),
    })
    return { ok: false, reason: message, session }
  }
}

async function syncRecord(input: {
  record: LocalEvidenceRecord
  bundle: LocalEvidenceBundle
  session: SyncSession
  evidenceRepo: OfflineEvidenceRepository
  syncRepo: FieldSyncRepository
  transport: SyncTransport
  onBytes: (n: number) => void
}): Promise<string> {
  const idem = submissionKey(
    input.record.local_evidence_id,
    input.record.local_revision,
    input.bundle.bundle_checksum,
  )

  const created = await input.transport.createSubmission(input.bundle.mission_id, {
    mission_id: input.bundle.mission_id,
    mission_task_id: input.record.task_id,
    evidence_type: mapLocalEvidenceType(input.record.evidence_type),
    captured_at: input.record.captured_at,
    device_timestamp: input.record.device_timestamp,
    description: `Sync local ${input.record.evidence_type}`,
    location: input.record.location?.lat != null
      ? {
          geometry: {
            type: 'Point',
            coordinates: [input.record.location.lng!, input.record.location.lat!],
          },
          accuracy_m: input.record.location.accuracy_m,
          method: input.record.location.method,
        }
      : undefined,
    metadata: {
      local_evidence_id: input.record.local_evidence_id,
      bundle_id: input.bundle.bundle_id,
      bundle_checksum: input.bundle.bundle_checksum,
      local_checksum: input.record.checksum,
    },
    requirement_ids: input.record.requirement_ids,
    idempotency_key: idem,
  })

  const submissionId = created.submission_id
  const assets = await input.evidenceRepo.listAssetsForEvidence(input.record.local_evidence_id)

  for (const asset of assets) {
    await syncAsset({
      asset,
      record: input.record,
      submissionId,
      session: input.session,
      evidenceRepo: input.evidenceRepo,
      syncRepo: input.syncRepo,
      transport: input.transport,
      onBytes: input.onBytes,
    })
  }

  if (input.record.structured_payload) {
    await input.transport.addObservation(submissionId, {
      fields: observationFieldsFromRecord(input.record),
      idempotency_key: observationKey(input.record.local_evidence_id, input.record.checksum),
    })
  }

  const localLinks = input.bundle.requirement_links.filter(
    (l) => l.local_evidence_id === input.record.local_evidence_id,
  )
  if (localLinks.length > 0) {
    await input.transport.linkRequirements(submissionId, {
      links: localLinks.map((l) => ({
        requirement_id: l.requirement_id,
        match_type: l.match_type,
        match_score: l.match_score,
        match_reason: l.match_reasons.join(';'),
        preliminary_coverage: l.coverage_status,
        idempotency_key: requirementLinkKey(submissionId, l.requirement_id),
      })),
    })
  }

  await input.transport.finalizeSubmission(submissionId, {
    idempotency_key: `finalize:${submissionId}:${input.bundle.bundle_checksum.slice(0, 16)}`,
  })

  for (let i = 0; i < PROCESSING_POLL_MAX; i++) {
    const snap = await input.transport.getSubmissionReconciliation(submissionId)
    if (snap.status === 'ready_for_validation') break
    if (['incomplete', 'duplicate', 'processing_failed', 'unsupported'].includes(snap.status)) break
    await new Promise((r) => setTimeout(r, PROCESSING_POLL_MS))
  }

  return submissionId
}

async function syncAsset(input: {
  asset: Awaited<ReturnType<OfflineEvidenceRepository['listAssetsForEvidence']>>[number]
  record: LocalEvidenceRecord
  submissionId: string
  session: SyncSession
  evidenceRepo: OfflineEvidenceRepository
  syncRepo: FieldSyncRepository
  transport: SyncTransport
  onBytes: (n: number) => void
}) {
  const blob = await input.evidenceRepo.getBlob(input.asset.blob_reference)
  if (!blob) throw new Error('asset_blob_missing')

  const uploadIdem = uploadSessionKey(input.asset.local_asset_id, input.asset.sha256)
  let uploadSession: AssetUploadSession = {
    upload_session_id: randomUUID(),
    sync_session_id: input.session.session_id,
    operation_id: randomUUID(),
    local_asset_id: input.asset.local_asset_id,
    local_evidence_id: input.record.local_evidence_id,
    remote_submission_id: input.submissionId,
    remote_upload_session_id: null,
    storage_path: null,
    upload_url: null,
    upload_url_expires_at: null,
    mime_type: input.asset.mime_type,
    original_filename: input.asset.original_filename,
    expected_size_bytes: input.asset.size_bytes,
    expected_checksum_sha256: input.asset.sha256,
    bytes_transferred: 0,
    status: 'pending',
    last_error: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  }

  const started = await input.transport.startUploadSession(input.submissionId, {
    local_asset_id: input.asset.local_asset_id,
    mime_type: input.asset.mime_type,
    original_filename: input.asset.original_filename,
    expected_size_bytes: input.asset.size_bytes,
    expected_checksum_sha256: input.asset.sha256,
    idempotency_key: uploadIdem,
  })

  uploadSession = mergeUploadProgress(uploadSession, started.bytes_transferred, 'uploading', {
    remote_upload_session_id: started.upload_session_id,
    storage_path: started.storage_path,
    upload_url: started.upload_url,
    upload_url_expires_at: started.expires_at,
  })
  await input.syncRepo.saveUploadSession(uploadSession)

  const uploadResult = await uploadAssetResumable({
    session: uploadSession,
    bytes: blob,
    put: (url, chunk, offset, total) => input.transport.putUploadBytes(url, chunk, offset, total),
    renewUrl: async () => {
      const renewed = await input.transport.renewUploadUrl(
        input.submissionId,
        started.upload_session_id,
      )
      return { upload_url: renewed.upload_url, expires_at: renewed.expires_at }
    },
    now_iso: nowIso(),
  })

  uploadSession = mergeUploadProgress(
    uploadSession,
    uploadResult.bytes_transferred,
    uploadResult.status,
    uploadResult.renewed
      ? { upload_url_expires_at: started.expires_at, status: 'uploading' }
      : {},
  )
  await input.syncRepo.saveUploadSession(uploadSession)

  if (!uploadResult.ok) throw new Error(uploadResult.reason ?? 'upload_failed')
  input.onBytes(blob.byteLength)

  const confirmed = await input.transport.confirmUpload(input.submissionId, {
    storage_path: started.storage_path,
    original_filename: input.asset.original_filename,
    mime_type: input.asset.mime_type,
    size_bytes: input.asset.size_bytes,
    checksum_sha256: input.asset.sha256,
    captured_at: input.asset.captured_at,
    duration_seconds: input.asset.duration_seconds,
    idempotency_key: assetKey(input.asset.local_asset_id, input.asset.sha256),
  })

  if (confirmed.asset_id) {
    uploadSession = mergeUploadProgress(uploadSession, blob.byteLength, 'confirmed')
    await input.syncRepo.saveUploadSession(uploadSession)
  }
}

async function recordConflict(
  repo: FieldSyncRepository,
  session: SyncSession,
  conflict: ReturnType<typeof buildConflict>,
) {
  await repo.saveConflict({
    conflict_id: repo.newId('conflict'),
    session_id: session.session_id,
    bundle_id: session.bundle_id,
    ...conflict,
    created_at: nowIso(),
  })
}

export async function pauseSyncSession(repo: FieldSyncRepository, sessionId: string) {
  const session = await repo.getSession(sessionId)
  if (!session) return null
  return updateSession(repo, session, { paused: true, status: 'sync_queued' })
}

export async function cancelSyncSession(repo: FieldSyncRepository, sessionId: string) {
  const session = await repo.getSession(sessionId)
  if (!session) return null
  return updateSession(repo, session, { cancelled: true, status: 'cancelled' })
}

export function computeSyncProgress(session: SyncSession, _operations: SyncOperation[]): number {
  if (session.bytes_total <= 0) return session.status === 'synced' ? 100 : 0
  return Math.min(100, Math.round((session.bytes_transferred / session.bytes_total) * 100))
}
