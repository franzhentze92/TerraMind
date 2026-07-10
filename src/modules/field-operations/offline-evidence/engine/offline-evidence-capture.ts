import { randomUUID } from 'node:crypto'

import {
  isMimeAllowed,
  LOW_STORAGE_WARNING_BYTES,
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  sanitizeFilename,
} from '@/modules/field-operations/offline-evidence/config/fire-offline-evidence.config'
import { scanNoteText } from '@/modules/field-operations/offline-evidence/offline-evidence-copy-guard'
import { bytesSha256 } from '@/modules/field-operations/offline-evidence/engine/offline-evidence-checksum'
import {
  buildTaskBundle,
  finalizeBundleStatus,
  verifyAssetIntegrity,
} from '@/modules/field-operations/offline-evidence/engine/offline-evidence-bundle'
import {
  detectAssetDuplicate,
  detectExactDuplicateByChecksum,
  detectPossibleDuplicate,
} from '@/modules/field-operations/offline-evidence/engine/offline-evidence-dedup'
import {
  computeRequirementCoverage,
  matchRecordToRequirements,
  parseRequirementsFromPackage,
} from '@/modules/field-operations/offline-evidence/engine/offline-evidence-matching'
import { assertNoTabConflict } from '@/modules/field-operations/offline-evidence/engine/offline-evidence-tab-conflict'
import {
  buildStructuredEvidencePayload,
  createTimestampCapture,
  evidenceTypeFromFormOutput,
  formOutputDedupKey,
  newAssetId,
  newBundleId,
  newEventId,
  newEvidenceId,
  structuredEvidenceChecksum,
} from '@/modules/field-operations/offline-evidence/engine/structured-evidence-from-form'
import type {
  CaptureContext,
  GeoLocationCapture,
  LocalEvidenceAsset,
  LocalEvidenceRecord,
} from '@/modules/field-operations/offline-evidence/offline-evidence.types'
import { OfflineEvidenceRepository } from '@/modules/field-operations/offline-evidence/offline-evidence.repository'
import type { FieldFormOutputPayload } from '@/modules/field-operations/field-forms/field-form.types'
import type { LocalOfflinePackageRecord } from '@/modules/field-operations/offline-packages/offline-package.repository'

export function assertCaptureAllowed(ctx: CaptureContext): { ok: boolean; reason?: string } {
  if (['revoked', 'superseded', 'integrity_failed'].includes(ctx.package_local_status)) {
    return { ok: false, reason: `package_${ctx.package_local_status}` }
  }
  return { ok: true }
}

export function buildGeoLocation(input: {
  lat?: number | null
  lng?: number | null
  accuracy_m?: number | null
  permission: GeoLocationCapture['permission']
  now_iso: string
}): GeoLocationCapture {
  return {
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    accuracy_m: input.accuracy_m ?? null,
    method:
      input.permission === 'denied'
        ? 'denied'
        : input.lat != null
          ? 'device_gps'
          : 'unavailable',
    captured_at: input.now_iso,
    permission: input.permission,
  }
}

async function recordEvent(
  repo: OfflineEvidenceRepository,
  event_type: string,
  payload: Record<string, unknown>,
  evidenceId?: string | null,
  bundleId?: string | null,
) {
  await repo.saveEvent({
    event_id: newEventId(),
    local_evidence_id: evidenceId ?? null,
    bundle_id: bundleId ?? null,
    event_type,
    payload,
    created_at: new Date().toISOString(),
  })
}

async function linkRecordRequirements(
  repo: OfflineEvidenceRepository,
  record: LocalEvidenceRecord,
  ctx: CaptureContext,
  pkgPayloads: Array<{ path: string; content: string }>,
) {
  const requirements = parseRequirementsFromPackage(pkgPayloads)
  const links = matchRecordToRequirements(record, requirements)
  for (const link of links) {
    await repo.saveLink(link)
    if (!record.requirement_ids.includes(link.requirement_id)) {
      record.requirement_ids.push(link.requirement_id)
    }
  }
  if (links.length > 0) await repo.saveRecord(record)
}

async function guardCapture(
  repo: OfflineEvidenceRepository,
  ctx: CaptureContext,
): Promise<{ ok: boolean; reason?: string }> {
  const gate = assertCaptureAllowed(ctx)
  if (!gate.ok) return gate
  const records = await repo.listRecordsForTask(ctx.package_id, ctx.task_id)
  const tab = await assertNoTabConflict(records, ctx.task_id, ctx.tab_id)
  if (!tab.ok) return tab
  return { ok: true }
}

export async function createStructuredEvidenceFromForm(input: {
  repo: OfflineEvidenceRepository
  ctx: CaptureContext
  output: FieldFormOutputPayload
  pkg_payloads: Array<{ path: string; content: string }>
  location?: GeoLocationCapture | null
}): Promise<{ created: boolean; record: LocalEvidenceRecord | null; reason?: string }> {
  const guard = await guardCapture(input.repo, input.ctx)
  if (!guard.ok) return { created: false, record: null, reason: guard.reason }

  const checksum = structuredEvidenceChecksum(input.output)
  const existing = await input.repo.listRecordsForTask(input.ctx.package_id, input.ctx.task_id)
  const dup = detectExactDuplicateByChecksum(checksum, existing)
  if (dup.kind === 'exact_duplicate') {
    return {
      created: false,
      record: await input.repo.getRecord(dup.existing_evidence_id!),
      reason: 'duplicate_form_output',
    }
  }

  const ts = createTimestampCapture(input.ctx.now_iso, input.output.captured_at)
  const record: LocalEvidenceRecord = {
    local_evidence_id: newEvidenceId(),
    package_id: input.ctx.package_id,
    package_version: input.ctx.package_version,
    mission_id: input.ctx.mission_id,
    task_id: input.ctx.task_id,
    requirement_ids: [],
    verification_need_ids: [],
    form_response_id: input.output.response_id,
    evidence_type: evidenceTypeFromFormOutput(input.output),
    status: 'ready',
    captured_at: input.output.captured_at,
    device_timestamp: ts.device_timestamp,
    created_at: input.ctx.now_iso,
    updated_at: input.ctx.now_iso,
    location: input.location ?? null,
    location_accuracy_m: input.location?.accuracy_m ?? null,
    source: 'form_output',
    metadata: {
      schema_id: input.output.schema_id,
      dedup_key: formOutputDedupKey(input.output, input.ctx.context_signature),
      timestamp: ts,
    },
    limitations: input.output.limitations,
    checksum,
    local_revision: 1,
    context_signature: input.ctx.context_signature,
    privacy_classification: 'internal',
    structured_payload: buildStructuredEvidencePayload(input.output),
    form_output_checksum: input.output.checksum,
    tab_id: input.ctx.tab_id,
  }

  await input.repo.saveRecord(record)
  await linkRecordRequirements(input.repo, record, input.ctx, input.pkg_payloads)
  await recordEvent(input.repo, 'structured_from_form', { checksum }, record.local_evidence_id)
  return { created: true, record }
}

export async function capturePhotoEvidence(input: {
  repo: OfflineEvidenceRepository
  ctx: CaptureContext
  pkg_payloads: Array<{ path: string; content: string }>
  bytes: Uint8Array
  mime_type: string
  filename: string
  location?: GeoLocationCapture | null
}): Promise<{ ok: boolean; record?: LocalEvidenceRecord; reason?: string }> {
  const guard = await guardCapture(input.repo, input.ctx)
  if (!guard.ok) return { ok: false, reason: guard.reason }
  if (!isMimeAllowed(input.mime_type, 'photo')) return { ok: false, reason: 'mime_not_allowed' }
  if (input.bytes.byteLength > MAX_PHOTO_BYTES) return { ok: false, reason: 'photo_too_large' }

  const sha256 = await bytesSha256(input.bytes)
  const packageAssets = await input.repo.listAssetsForPackage(input.ctx.package_id)
  const packageRecords = await input.repo.listRecordsForPackage(input.ctx.package_id)
  const recordsById = new Map(packageRecords.map((r) => [r.local_evidence_id, r]))
  const exact = detectAssetDuplicate(sha256, packageAssets, input.ctx.task_id, recordsById)
  if (exact.kind === 'exact_duplicate') return { ok: false, reason: 'exact_duplicate' }

  const possible = detectPossibleDuplicate(
    { size_bytes: input.bytes.byteLength, captured_at: input.ctx.now_iso, mime_type: input.mime_type },
    packageAssets,
  )

  const ts = createTimestampCapture(input.ctx.now_iso)
  const evidenceId = newEvidenceId()
  const assetId = newAssetId()
  const blobRef = `blob:${evidenceId}:${assetId}`
  await input.repo.putBlob(blobRef, input.bytes)

  const hasGps = input.location?.lat != null && input.location?.lng != null
  const record: LocalEvidenceRecord = {
    local_evidence_id: evidenceId,
    package_id: input.ctx.package_id,
    package_version: input.ctx.package_version,
    mission_id: input.ctx.mission_id,
    task_id: input.ctx.task_id,
    requirement_ids: [],
    verification_need_ids: [],
    form_response_id: null,
    evidence_type: hasGps ? 'georeferenced_photo' : 'timestamped_photo',
    status: possible.kind === 'possible_duplicate' ? 'duplicate' : 'ready',
    captured_at: input.ctx.now_iso,
    device_timestamp: ts.device_timestamp,
    created_at: input.ctx.now_iso,
    updated_at: input.ctx.now_iso,
    location: input.location ?? null,
    location_accuracy_m: input.location?.accuracy_m ?? null,
    source: 'camera',
    metadata: { timestamp: ts },
    limitations: input.location?.permission === 'denied' ? ['gps_unavailable'] : [],
    checksum: sha256,
    local_revision: 1,
    context_signature: input.ctx.context_signature,
    privacy_classification: hasGps ? 'restricted' : 'internal',
    structured_payload: null,
    form_output_checksum: null,
    tab_id: input.ctx.tab_id,
  }

  const asset: LocalEvidenceAsset = {
    local_asset_id: assetId,
    local_evidence_id: evidenceId,
    asset_type: 'photo',
    blob_reference: blobRef,
    original_filename: sanitizeFilename(input.filename),
    mime_type: input.mime_type,
    size_bytes: input.bytes.byteLength,
    sha256,
    width: null,
    height: null,
    duration_seconds: null,
    captured_at: input.ctx.now_iso,
    metadata: {},
    storage_backend: typeof indexedDB !== 'undefined' ? 'indexeddb' : 'memory',
    created_at: input.ctx.now_iso,
  }

  await input.repo.saveRecord(record)
  await input.repo.saveAsset(asset)
  await linkRecordRequirements(input.repo, record, input.ctx, input.pkg_payloads)
  await recordEvent(input.repo, 'photo_captured', { sha256 }, evidenceId)
  return { ok: true, record }
}

export async function captureVideoEvidence(input: {
  repo: OfflineEvidenceRepository
  ctx: CaptureContext
  pkg_payloads: Array<{ path: string; content: string }>
  bytes: Uint8Array
  mime_type: string
  filename: string
  duration_seconds: number
  location?: GeoLocationCapture | null
}): Promise<{ ok: boolean; record?: LocalEvidenceRecord; reason?: string }> {
  const guard = await guardCapture(input.repo, input.ctx)
  if (!guard.ok) return { ok: false, reason: guard.reason }
  if (!isMimeAllowed(input.mime_type, 'video')) return { ok: false, reason: 'mime_not_allowed' }
  if (input.bytes.byteLength > MAX_VIDEO_BYTES) return { ok: false, reason: 'video_too_large' }
  if (input.duration_seconds > MAX_VIDEO_DURATION_SECONDS) return { ok: false, reason: 'video_too_long' }

  const sha256 = await bytesSha256(input.bytes)
  const evidenceId = newEvidenceId()
  const assetId = newAssetId()
  const blobRef = `blob:${evidenceId}:${assetId}`
  await input.repo.putBlob(blobRef, input.bytes)
  const ts = createTimestampCapture(input.ctx.now_iso)

  const record: LocalEvidenceRecord = {
    local_evidence_id: evidenceId,
    package_id: input.ctx.package_id,
    package_version: input.ctx.package_version,
    mission_id: input.ctx.mission_id,
    task_id: input.ctx.task_id,
    requirement_ids: [],
    verification_need_ids: [],
    form_response_id: null,
    evidence_type: 'video',
    status: 'ready',
    captured_at: input.ctx.now_iso,
    device_timestamp: ts.device_timestamp,
    created_at: input.ctx.now_iso,
    updated_at: input.ctx.now_iso,
    location: input.location ?? null,
    location_accuracy_m: input.location?.accuracy_m ?? null,
    source: 'camera',
    metadata: { duration_seconds: input.duration_seconds, timestamp: ts },
    limitations: [],
    checksum: sha256,
    local_revision: 1,
    context_signature: input.ctx.context_signature,
    privacy_classification: 'internal',
    structured_payload: null,
    form_output_checksum: null,
    tab_id: input.ctx.tab_id,
  }

  const asset: LocalEvidenceAsset = {
    local_asset_id: assetId,
    local_evidence_id: evidenceId,
    asset_type: 'video',
    blob_reference: blobRef,
    original_filename: sanitizeFilename(input.filename),
    mime_type: input.mime_type,
    size_bytes: input.bytes.byteLength,
    sha256,
    width: null,
    height: null,
    duration_seconds: input.duration_seconds,
    captured_at: input.ctx.now_iso,
    metadata: {},
    storage_backend: typeof indexedDB !== 'undefined' ? 'indexeddb' : 'memory',
    created_at: input.ctx.now_iso,
  }

  await input.repo.saveRecord(record)
  await input.repo.saveAsset(asset)
  await linkRecordRequirements(input.repo, record, input.ctx, input.pkg_payloads)
  await recordEvent(input.repo, 'video_captured', { sha256 }, evidenceId)
  return { ok: true, record }
}

export async function addTimestampedNote(input: {
  repo: OfflineEvidenceRepository
  ctx: CaptureContext
  pkg_payloads: Array<{ path: string; content: string }>
  note: string
}): Promise<{ ok: boolean; record?: LocalEvidenceRecord; reason?: string }> {
  const guard = await guardCapture(input.repo, input.ctx)
  if (!guard.ok) return { ok: false, reason: guard.reason }
  if (scanNoteText(input.note)) return { ok: false, reason: 'forbidden_copy' }

  const ts = createTimestampCapture(input.ctx.now_iso)
  const checksum = await bytesSha256(new TextEncoder().encode(input.note))
  const record: LocalEvidenceRecord = {
    local_evidence_id: newEvidenceId(),
    package_id: input.ctx.package_id,
    package_version: input.ctx.package_version,
    mission_id: input.ctx.mission_id,
    task_id: input.ctx.task_id,
    requirement_ids: [],
    verification_need_ids: [],
    form_response_id: null,
    evidence_type: 'timestamped_note',
    status: 'ready',
    captured_at: input.ctx.now_iso,
    device_timestamp: ts.device_timestamp,
    created_at: input.ctx.now_iso,
    updated_at: input.ctx.now_iso,
    location: null,
    location_accuracy_m: null,
    source: 'manual_note',
    metadata: { timestamp: ts },
    limitations: [],
    checksum,
    local_revision: 1,
    context_signature: input.ctx.context_signature,
    privacy_classification: 'internal',
    structured_payload: { note: input.note },
    form_output_checksum: null,
    tab_id: input.ctx.tab_id,
  }
  await input.repo.saveRecord(record)
  await linkRecordRequirements(input.repo, record, input.ctx, input.pkg_payloads)
  return { ok: true, record }
}

export async function verifyAllAssets(repo: OfflineEvidenceRepository, packageId: string) {
  const corrupted: string[] = []
  for (const asset of await repo.listAssetsForPackage(packageId)) {
    const blob = await repo.getBlob(asset.blob_reference)
    const integrity = verifyAssetIntegrity(asset, blob !== null, blob ? await bytesSha256(blob) : null)
    if (!integrity.ok) {
      corrupted.push(asset.local_evidence_id)
      const record = await repo.getRecord(asset.local_evidence_id)
      if (record) await repo.saveRecord({ ...record, status: 'corrupted', updated_at: new Date().toISOString() })
    }
  }
  return { corrupted }
}

export async function buildAndFinalizeTaskBundle(input: {
  repo: OfflineEvidenceRepository
  pkg: LocalOfflinePackageRecord
  task_id: string
  allow_limitations?: boolean
  tab_id: string
}) {
  const records = await input.repo.listRecordsForTask(input.pkg.package_id, input.task_id)
  const assets = await input.repo.listAssetsForPackage(input.pkg.package_id)
  const links = await input.repo.listLinksForPackage(input.pkg.package_id)
  const requirements = parseRequirementsFromPackage(input.pkg.payloads)
  const coverage = computeRequirementCoverage(requirements, records, links)
  const bundle = buildTaskBundle({
    bundle_id: newBundleId(),
    package_id: input.pkg.package_id,
    package_version: input.pkg.package_version,
    mission_id: input.pkg.mission_id,
    task_id: input.task_id,
    records,
    assets,
    links,
    coverage,
    limitations: [...new Set(records.flatMap((r) => r.limitations))],
    now_iso: new Date().toISOString(),
    tab_id: input.tab_id,
  })
  bundle.status = finalizeBundleStatus(bundle, Boolean(input.allow_limitations))
  await input.repo.saveBundle(bundle)
  await recordEvent(input.repo, 'bundle_prepared', { status: bundle.status }, null, bundle.bundle_id)
  return { bundle, coverage }
}

export function captureContextFromPackage(
  pkg: LocalOfflinePackageRecord,
  task_id: string,
  tab_id: string,
  now_iso: string,
): CaptureContext {
  return {
    package_id: pkg.package_id,
    package_version: pkg.package_version,
    mission_id: pkg.mission_id,
    task_id,
    context_signature: pkg.manifest.context_signature,
    tab_id,
    package_local_status: pkg.local_status,
    now_iso,
  }
}

export async function deleteLocalEvidence(input: {
  repo: OfflineEvidenceRepository
  evidence_id: string
  confirm: boolean
}) {
  if (!input.confirm) return { ok: false, reason: 'confirmation_required' }
  const record = await input.repo.getRecord(input.evidence_id)
  if (!record) return { ok: false, reason: 'not_found' }
  for (const asset of await input.repo.listAssetsForEvidence(record.local_evidence_id)) {
    await input.repo.deleteBlob(asset.blob_reference)
  }
  await input.repo.saveRecord({ ...record, status: 'deleted_pending_sync', updated_at: new Date().toISOString() })
  await recordEvent(input.repo, 'delete_requested', {}, record.local_evidence_id)
  return { ok: true }
}

export async function estimateStorageWarning(repo: OfflineEvidenceRepository): Promise<string | null> {
  const used = await repo.estimateStorageBytes()
  return used > LOW_STORAGE_WARNING_BYTES ? 'low_storage_warning' : null
}
