import { describe, expect, it } from 'vitest'

import { FIRE_FIELD_SYNC_MODEL_VERSION } from '@/modules/field-operations/field-sync/config/fire-field-sync.config'
import { createMockSyncTransport } from '@/modules/field-operations/field-sync/api/field-sync-mock-transport'
import { evaluateSyncEligibility } from '@/modules/field-operations/field-sync/engine/field-sync-eligibility'
import { evaluateReconciliation } from '@/modules/field-operations/field-sync/engine/field-sync-reconciliation'
import { uploadAssetResumable } from '@/modules/field-operations/field-sync/engine/field-sync-resumable-upload'
import {
  cancelSyncSession,
  pauseSyncSession,
  syncBundle,
} from '@/modules/field-operations/field-sync/engine/field-sync.orchestrator'
import { submissionKey } from '@/modules/field-operations/field-sync/engine/field-sync-idempotency'
import { FieldSyncRepository } from '@/modules/field-operations/field-sync/field-sync.repository'
import type { LocalEvidenceBundle, LocalEvidenceRecord } from '@/modules/field-operations/offline-evidence/offline-evidence.types'
import { OfflineEvidenceRepository } from '@/modules/field-operations/offline-evidence/offline-evidence.repository'
import type { LocalOfflinePackageRecord } from '@/modules/field-operations/offline-packages/offline-package.repository'

const BUNDLE_ID = '00000000-0000-4000-a002-000000000601'
const MISSION_ID = '00000000-0000-4000-a002-000000000001'
const TASK_ID = '00000000-0000-4000-a002-000000000101'
const RECORD_ID = '00000000-0000-4000-a002-000000000701'
const ASSET_ID = '00000000-0000-4000-a002-000000000801'

function pkg(): LocalOfflinePackageRecord {
  return {
    package_id: '00000000-0000-4000-a002-000000000501',
    mission_id: MISSION_ID,
    mission_title: 'Test',
    package_version: 1,
    local_status: 'available',
    manifest: { context_signature: 'ctx' } as never,
    payloads: [],
    downloaded_at: '2026-07-10T12:00:00.000Z',
    superseded_by: null,
    size_bytes: 1000,
    integrity_errors: [],
    updated_at: '2026-07-10T12:00:00.000Z',
  }
}

function structuredRecord(): LocalEvidenceRecord {
  return {
    local_evidence_id: RECORD_ID,
    package_id: pkg().package_id,
    package_version: 1,
    mission_id: MISSION_ID,
    task_id: TASK_ID,
    requirement_ids: ['00000000-0000-4000-a002-000000000201'],
    verification_need_ids: [],
    form_response_id: 'resp-1',
    evidence_type: 'structured_observation',
    status: 'ready',
    captured_at: '2026-07-10T12:00:00.000Z',
    device_timestamp: '2026-07-10T12:00:00.000Z',
    created_at: '2026-07-10T12:00:00.000Z',
    updated_at: '2026-07-10T12:00:00.000Z',
    location: null,
    location_accuracy_m: null,
    source: 'form_output',
    metadata: {},
    limitations: [],
    checksum: 'abc',
    local_revision: 1,
    context_signature: 'ctx',
    privacy_classification: 'internal',
    structured_payload: {
      answers: { visible_smoke: 'no', observer_notes: 'Observación estructurada recibida' },
    },
    form_output_checksum: 'form-check',
    tab_id: 'tab-a',
  }
}

function photoRecord(): LocalEvidenceRecord {
  return {
    ...structuredRecord(),
    local_evidence_id: '00000000-0000-4000-a002-000000000702',
    evidence_type: 'georeferenced_photo',
    structured_payload: null,
    form_response_id: null,
    checksum: 'photo-check',
    location: {
      lat: 14.6,
      lng: -90.5,
      accuracy_m: 10,
      method: 'device_gps',
      captured_at: '2026-07-10T12:00:00.000Z',
      permission: 'granted',
    },
  }
}

function pendingBundle(recordIds: string[]): LocalEvidenceBundle {
  return {
    bundle_id: BUNDLE_ID,
    package_id: pkg().package_id,
    package_version: 1,
    mission_id: MISSION_ID,
    task_id: TASK_ID,
    form_response_ids: ['resp-1'],
    evidence_record_ids: recordIds,
    requirement_links: [
      {
        local_evidence_id: RECORD_ID,
        requirement_id: '00000000-0000-4000-a002-000000000201',
        match_type: 'matched',
        match_score: 80,
        match_reasons: ['evidence_type_match'],
        coverage_status: 'partial',
      },
    ],
    captured_at_range: { start: '2026-07-10T12:00:00.000Z', end: '2026-07-10T12:00:00.000Z' },
    location_summary: {},
    limitations: [],
    bundle_checksum: 'bundle-checksum-abc',
    status: 'pending_sync',
    size_bytes: 2048,
    supersedes_bundle_id: null,
    created_at: '2026-07-10T12:00:00.000Z',
    updated_at: '2026-07-10T12:00:00.000Z',
    tab_id: 'tab-a',
  }
}

async function seedPhotoAsset(evidenceRepo: OfflineEvidenceRepository, record: LocalEvidenceRecord) {
  const bytes = new TextEncoder().encode('synthetic-photo-bytes')
  const blobRef = `blob:${record.local_evidence_id}:${ASSET_ID}`
  await evidenceRepo.putBlob(blobRef, bytes)
  await evidenceRepo.saveAsset({
    local_asset_id: ASSET_ID,
    local_evidence_id: record.local_evidence_id,
    asset_type: 'photo',
    blob_reference: blobRef,
    original_filename: 'campo.jpg',
    mime_type: 'image/jpeg',
    size_bytes: bytes.byteLength,
    sha256: 'a'.repeat(64),
    width: null,
    height: null,
    duration_seconds: null,
    captured_at: record.captured_at,
    metadata: {},
    storage_backend: 'memory',
    created_at: record.captured_at,
  })
}

describe('field sync engine — 8B.7D', () => {
  it('freezes fire-field-sync model v1.0.0', () => {
    expect(FIRE_FIELD_SYNC_MODEL_VERSION).toBe('1.0.0')
  })

  it('pending bundle creates a single remote submission per record', async () => {
    const evidenceRepo = OfflineEvidenceRepository.createInMemory()
    const syncRepo = FieldSyncRepository.createInMemory()
    const transport = createMockSyncTransport()
    const record = structuredRecord()
    await evidenceRepo.saveRecord(record)
    const bundle = pendingBundle([record.local_evidence_id])
    await evidenceRepo.saveBundle(bundle)

    const first = await syncBundle({
      bundle,
      pkg: pkg(),
      evidenceRepo,
      syncRepo,
      transport,
      tab_id: 'tab-a',
    })
    expect(first.ok).toBe(true)

    const updated = await evidenceRepo.getBundle(bundle.bundle_id)
    expect(updated?.status).toBe('synced')

    const mock = transport as ReturnType<typeof createMockSyncTransport> & { _submissions: Map<string, unknown> }
    expect(mock._submissions.size).toBe(1)
  })

  it('repeating sync does not duplicate remote submissions', async () => {
    const evidenceRepo = OfflineEvidenceRepository.createInMemory()
    const syncRepo = FieldSyncRepository.createInMemory()
    const transport = createMockSyncTransport()
    const record = structuredRecord()
    await evidenceRepo.saveRecord(record)
    const bundle = pendingBundle([record.local_evidence_id])
    await evidenceRepo.saveBundle(bundle)

    await syncBundle({ bundle, pkg: pkg(), evidenceRepo, syncRepo, transport, tab_id: 'tab-a' })
    const bundleResync = { ...bundle, status: 'pending_sync' as const }
    await evidenceRepo.saveBundle(bundleResync)
    await syncBundle({ bundle: bundleResync, pkg: pkg(), evidenceRepo, syncRepo, transport, tab_id: 'tab-a' })

    const mock = transport as ReturnType<typeof createMockSyncTransport> & { _submissions: Map<string, unknown> }
    expect(mock._submissions.size).toBe(1)
  })

  it('resumable upload completes after interruption', async () => {
    const session = {
      upload_session_id: 'u1',
      sync_session_id: 's1',
      operation_id: 'o1',
      local_asset_id: ASSET_ID,
      local_evidence_id: RECORD_ID,
      remote_submission_id: 'sub-1',
      remote_upload_session_id: 'rs1',
      storage_path: 'path',
      upload_url: 'mock://upload/key1',
      upload_url_expires_at: new Date(Date.now() + 60_000).toISOString(),
      mime_type: 'image/jpeg',
      original_filename: 'a.jpg',
      expected_size_bytes: 10,
      expected_checksum_sha256: 'a'.repeat(64),
      bytes_transferred: 0,
      status: 'pending' as const,
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const bytes = new TextEncoder().encode('1234567890')
    let calls = 0
    const result = await uploadAssetResumable({
      session,
      bytes,
      now_iso: new Date().toISOString(),
      put: async (_url, chunk, offset) => {
        calls++
        if (calls === 1) throw new Error('network_interrupted')
        return { bytes_written: chunk.byteLength }
      },
      renewUrl: async () => ({
        upload_url: 'mock://upload/renewed/key1',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      }),
    })
    expect(result.ok).toBe(false)
    expect(result.bytes_transferred).toBe(0)

    const resume = await uploadAssetResumable({
      session: { ...session, bytes_transferred: 0, upload_url: 'mock://upload/renewed/key1' },
      bytes,
      now_iso: new Date().toISOString(),
      put: async (_url, chunk) => ({ bytes_written: chunk.byteLength }),
    })
    expect(resume.ok).toBe(true)
  })

  it('expired upload URL can be renewed', async () => {
    const transport = createMockSyncTransport({ expire_url_once: true })
    const started = await transport.startUploadSession('sub-1', {
      local_asset_id: ASSET_ID,
      mime_type: 'image/jpeg',
      original_filename: 'a.jpg',
      expected_size_bytes: 4,
      expected_checksum_sha256: 'a'.repeat(64),
      idempotency_key: 'upload-key',
    })
    const renewed = await transport.renewUploadUrl('sub-1', started.upload_session_id)
    expect(renewed.upload_url).toContain('renewed')
  })

  it('checksum mismatch blocks finalize path', async () => {
    const transport = createMockSyncTransport({ checksum_mismatch_on_confirm: true })
    await transport.createSubmission(MISSION_ID, {
      mission_id: MISSION_ID,
      mission_task_id: TASK_ID,
      evidence_type: 'georeferenced_photo',
      captured_at: null,
      device_timestamp: null,
      idempotency_key: 'k1',
    })
    await expect(
      transport.confirmUpload('sub-1', {
        storage_path: 'p',
        original_filename: 'a.jpg',
        mime_type: 'image/jpeg',
        size_bytes: 10,
        checksum_sha256: 'b'.repeat(64),
        idempotency_key: 'asset-k',
      }),
    ).rejects.toThrow('checksum_mismatch')
  })

  it('mission cancelled produces conflict without deleting local evidence', async () => {
    const evidenceRepo = OfflineEvidenceRepository.createInMemory()
    const syncRepo = FieldSyncRepository.createInMemory()
    const transport = createMockSyncTransport({ mission_cancelled: true })
    const record = structuredRecord()
    await evidenceRepo.saveRecord(record)
    const bundle = pendingBundle([record.local_evidence_id])
    await evidenceRepo.saveBundle(bundle)

    const result = await syncBundle({ bundle, pkg: pkg(), evidenceRepo, syncRepo, transport, tab_id: 'tab-a' })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('mission_cancelled')
    expect(await evidenceRepo.getRecord(record.local_evidence_id)).toBeTruthy()
    const conflicts = await syncRepo.listConflictsForSession(result.session!.session_id)
    expect(conflicts.length).toBeGreaterThan(0)
  })

  it('revoked package blocks sync safely', async () => {
    const transport = createMockSyncTransport({ package_revoked: true })
    const evidenceRepo = OfflineEvidenceRepository.createInMemory()
    const syncRepo = FieldSyncRepository.createInMemory()
    const record = structuredRecord()
    await evidenceRepo.saveRecord(record)
    const bundle = pendingBundle([record.local_evidence_id])
    await evidenceRepo.saveBundle(bundle)

    const result = await syncBundle({ bundle, pkg: pkg(), evidenceRepo, syncRepo, transport, tab_id: 'tab-a' })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('package_revoked')
  })

  it('partial sync does not mark bundle synced', async () => {
    const transport = createMockSyncTransport({ processing_status: 'incomplete' })
    const evidenceRepo = OfflineEvidenceRepository.createInMemory()
    const syncRepo = FieldSyncRepository.createInMemory()
    const record = structuredRecord()
    await evidenceRepo.saveRecord(record)
    const bundle = pendingBundle([record.local_evidence_id])
    await evidenceRepo.saveBundle(bundle)

    const result = await syncBundle({ bundle, pkg: pkg(), evidenceRepo, syncRepo, transport, tab_id: 'tab-a' })
    expect(result.ok).toBe(false)
    const updated = await evidenceRepo.getBundle(bundle.bundle_id)
    expect(updated?.status).toBe('pending_sync')
  })

  it('full reconciliation marks bundle synced', async () => {
    const evidenceRepo = OfflineEvidenceRepository.createInMemory()
    const syncRepo = FieldSyncRepository.createInMemory()
    const transport = createMockSyncTransport()
    const record = structuredRecord()
    await evidenceRepo.saveRecord(record)
    const bundle = pendingBundle([record.local_evidence_id])
    await evidenceRepo.saveBundle(bundle)

    await syncBundle({ bundle, pkg: pkg(), evidenceRepo, syncRepo, transport, tab_id: 'tab-a' })
    const updated = await evidenceRepo.getBundle(bundle.bundle_id)
    expect(updated?.status).toBe('synced')
    const mappings = await syncRepo.listMappingsForBundle(bundle.bundle_id)
    expect(mappings.length).toBe(1)
  })

  it('photo bundle syncs asset and reaches ready_for_validation', async () => {
    const evidenceRepo = OfflineEvidenceRepository.createInMemory()
    const syncRepo = FieldSyncRepository.createInMemory()
    const transport = createMockSyncTransport()
    const record = photoRecord()
    await evidenceRepo.saveRecord(record)
    await seedPhotoAsset(evidenceRepo, record)
    const bundle = {
      ...pendingBundle([record.local_evidence_id]),
      evidence_record_ids: [record.local_evidence_id],
    }
    await evidenceRepo.saveBundle(bundle)

    const result = await syncBundle({ bundle, pkg: pkg(), evidenceRepo, syncRepo, transport, tab_id: 'tab-a' })
    expect(result.ok).toBe(true)
    const snap = await transport.getSubmissionReconciliation('sub-1')
    expect(snap.status).toBe('ready_for_validation')
    expect(snap.assets.length).toBe(1)
  })

  it('idempotency keys are stable', () => {
    expect(submissionKey('e1', 2, 'checksum')).toMatch(/^submission:e1:r2:/)
  })

  it('reconciliation detects missing submissions', () => {
    const result = evaluateReconciliation({
      bundle_id: BUNDLE_ID,
      bundle_checksum: 'x',
      expected_record_count: 2,
      submissions: [
        {
          submission_id: 's1',
          status: 'ready_for_validation',
          evidence_type: 'structured_observation',
          assets: [],
          has_observation: true,
          requirement_link_count: 1,
        },
      ],
    })
    expect(result.ok).toBe(false)
    expect(result.reasons).toContain('missing_submissions')
  })

  it('two tabs cannot sync same bundle simultaneously', async () => {
    const syncRepo = FieldSyncRepository.createInMemory()
    await syncRepo.saveSession({
      session_id: 'existing',
      bundle_id: BUNDLE_ID,
      bundle_checksum: 'bundle-checksum-abc',
      package_id: pkg().package_id,
      package_version: 1,
      mission_id: MISSION_ID,
      task_id: TASK_ID,
      status: 'syncing',
      tab_id: 'tab-other',
      attempt: 1,
      max_attempts: 8,
      next_retry_at: null,
      last_error: null,
      error_classification: null,
      bytes_total: 100,
      bytes_transferred: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      completed_at: null,
      paused: false,
      cancelled: false,
    })

    const result = await syncBundle({
      bundle: pendingBundle([RECORD_ID]),
      pkg: pkg(),
      evidenceRepo: OfflineEvidenceRepository.createInMemory(),
      syncRepo,
      transport: createMockSyncTransport(),
      tab_id: 'tab-a',
    })
    expect(result.reason).toBe('sync_tab_conflict')
  })

  it('pause and cancel preserve local evidence', async () => {
    const syncRepo = FieldSyncRepository.createInMemory()
    const session = {
      session_id: 's1',
      bundle_id: BUNDLE_ID,
      bundle_checksum: 'x',
      package_id: pkg().package_id,
      package_version: 1,
      mission_id: MISSION_ID,
      task_id: TASK_ID,
      status: 'syncing' as const,
      tab_id: 'tab-a',
      attempt: 1,
      max_attempts: 8,
      next_retry_at: null,
      last_error: null,
      error_classification: null,
      bytes_total: 100,
      bytes_transferred: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      completed_at: null,
      paused: false,
      cancelled: false,
    }
    await syncRepo.saveSession(session)
    const paused = await pauseSyncSession(syncRepo, 's1')
    expect(paused?.paused).toBe(true)
    const cancelled = await cancelSyncSession(syncRepo, 's1')
    expect(cancelled?.cancelled).toBe(true)
  })

  it('eligibility rejects non pending_sync bundles', () => {
    const result = evaluateSyncEligibility({
      bundle: { ...pendingBundle([RECORD_ID]), status: 'incomplete' },
      pkg: pkg(),
      now_iso: new Date().toISOString(),
    })
    expect(result.eligible).toBe(false)
  })
})
