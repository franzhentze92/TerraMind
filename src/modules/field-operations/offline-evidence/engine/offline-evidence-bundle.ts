import { CRITICAL_EVIDENCE_TYPES } from '@/modules/field-operations/offline-evidence/config/fire-offline-evidence.config'
import { canonicalJson, sha256Hex } from '@/modules/field-operations/offline-evidence/engine/offline-evidence-checksum'
import type {
  LocalEvidenceAsset,
  LocalEvidenceBundle,
  LocalEvidenceRecord,
  LocalEvidenceRequirementLink,
  RequirementCoverageSummary,
} from '@/modules/field-operations/offline-evidence/offline-evidence.types'

const EXCLUDED_STATUSES = new Set([
  'corrupted',
  'duplicate',
  'superseded',
  'deleted_pending_sync',
])

export function bundleBodyChecksum(input: {
  bundle_id: string
  package_id: string
  package_version: number
  mission_id: string
  task_id: string
  form_response_ids: string[]
  evidence_records: LocalEvidenceRecord[]
  assets: LocalEvidenceAsset[]
  requirement_links: LocalEvidenceRequirementLink[]
  limitations: string[]
  status: string
}): string {
  const body = {
    bundle_id: input.bundle_id,
    package_id: input.package_id,
    package_version: input.package_version,
    mission_id: input.mission_id,
    task_id: input.task_id,
    form_response_ids: [...input.form_response_ids].sort(),
    evidence_records: input.evidence_records
      .map((r) => ({
        id: r.local_evidence_id,
        type: r.evidence_type,
        checksum: r.checksum,
        captured_at: r.captured_at,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    assets: input.assets
      .map((a) => ({
        id: a.local_asset_id,
        sha256: a.sha256,
        captured_at: a.captured_at,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    requirement_links: input.requirement_links
      .map((l) => ({
        evidence_id: l.local_evidence_id,
        requirement_id: l.requirement_id,
        match_type: l.match_type,
      }))
      .sort((a, b) => `${a.evidence_id}:${a.requirement_id}`.localeCompare(`${b.evidence_id}:${b.requirement_id}`)),
    limitations: [...input.limitations].sort(),
    status: input.status,
  }
  return sha256Hex(canonicalJson(body))
}

export function buildTaskBundle(input: {
  bundle_id: string
  package_id: string
  package_version: number
  mission_id: string
  task_id: string
  records: LocalEvidenceRecord[]
  assets: LocalEvidenceAsset[]
  links: LocalEvidenceRequirementLink[]
  coverage: RequirementCoverageSummary[]
  limitations: string[]
  now_iso: string
  tab_id: string | null
}): LocalEvidenceBundle {
  const eligibleRecords = input.records.filter(
    (r) => r.task_id === input.task_id && !EXCLUDED_STATUSES.has(r.status),
  )
  const recordIds = new Set(eligibleRecords.map((r) => r.local_evidence_id))
  const eligibleAssets = input.assets.filter((a) => recordIds.has(a.local_evidence_id))
  const eligibleLinks = input.links.filter((l) => recordIds.has(l.local_evidence_id))

  const timestamps = eligibleRecords.map((r) => Date.parse(r.captured_at)).filter((n) => !Number.isNaN(n))
  const formIds = [...new Set(eligibleRecords.map((r) => r.form_response_id).filter(Boolean))] as string[]

  const status = evaluateBundleStatus(input.coverage, eligibleRecords, input.limitations)

  const checksum = bundleBodyChecksum({
    bundle_id: input.bundle_id,
    package_id: input.package_id,
    package_version: input.package_version,
    mission_id: input.mission_id,
    task_id: input.task_id,
    form_response_ids: formIds,
    evidence_records: eligibleRecords,
    assets: eligibleAssets,
    requirement_links: eligibleLinks,
    limitations: input.limitations,
    status,
  })

  const size_bytes = eligibleAssets.reduce((sum, a) => sum + a.size_bytes, 0)

  return {
    bundle_id: input.bundle_id,
    package_id: input.package_id,
    package_version: input.package_version,
    mission_id: input.mission_id,
    task_id: input.task_id,
    form_response_ids: formIds.sort(),
    evidence_record_ids: eligibleRecords.map((r) => r.local_evidence_id).sort(),
    requirement_links: eligibleLinks,
    captured_at_range: {
      start: timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null,
      end: timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null,
    },
    location_summary: summarizeLocations(eligibleRecords),
    limitations: input.limitations,
    bundle_checksum: checksum,
    status,
    size_bytes,
    supersedes_bundle_id: null,
    created_at: input.now_iso,
    updated_at: input.now_iso,
    tab_id: input.tab_id,
  }
}

function summarizeLocations(records: LocalEvidenceRecord[]): Record<string, unknown> {
  const points = records
    .filter((r) => r.location?.lat != null && r.location?.lng != null)
    .map((r) => ({ lat: r.location!.lat, lng: r.location!.lng, accuracy_m: r.location!.accuracy_m }))
  return { point_count: points.length, points: points.slice(0, 5) }
}

export function evaluateBundleStatus(
  coverage: RequirementCoverageSummary[],
  records: LocalEvidenceRecord[],
  limitations: string[],
): LocalEvidenceBundle['status'] {
  if (records.some((r) => r.status === 'corrupted')) return 'sync_blocked'
  const required = coverage.filter((c) => c.minimum_count > 0)
  const criticalMissing = required.some((c) => {
    const isCritical = CRITICAL_EVIDENCE_TYPES.has(c.evidence_type as never)
    return isCritical && c.captured_count < c.minimum_count
  })
  if (criticalMissing) return 'incomplete'

  const anyMissing = required.some((c) => c.captured_count < c.minimum_count)
  if (anyMissing) return 'incomplete'

  if (limitations.length > 0 || coverage.some((c) => c.warnings.length > 0)) {
    return 'pending_sync'
  }
  return records.length > 0 ? 'pending_sync' : 'incomplete'
}

export function finalizeBundleStatus(
  bundle: LocalEvidenceBundle,
  allowLimitations: boolean,
): LocalEvidenceBundle['status'] {
  if (bundle.status === 'sync_blocked') return 'sync_blocked'
  if (bundle.status === 'incomplete') {
    if (allowLimitations && bundle.limitations.length > 0) return 'pending_sync'
    return 'incomplete'
  }
  return 'pending_sync'
}

export function verifyAssetIntegrity(
  asset: LocalEvidenceAsset,
  blobExists: boolean,
  blobSha256: string | null,
): { ok: boolean; corrupted: boolean; reasons: string[] } {
  const reasons: string[] = []
  if (!blobExists) reasons.push('blob_missing')
  if (blobSha256 && blobSha256 !== asset.sha256) reasons.push('checksum_mismatch')
  return { ok: reasons.length === 0, corrupted: reasons.length > 0, reasons }
}
