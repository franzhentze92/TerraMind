import type { DuplicateKind, LocalEvidenceAsset, LocalEvidenceRecord } from '@/modules/field-operations/offline-evidence/offline-evidence.types'

export interface DuplicateDetectionResult {
  kind: DuplicateKind | null
  existing_evidence_id: string | null
  existing_asset_id: string | null
  reasons: string[]
}

export function detectExactDuplicateByChecksum(
  checksum: string,
  records: LocalEvidenceRecord[],
  excludeId?: string,
): DuplicateDetectionResult {
  const hit = records.find(
    (r) => r.checksum === checksum && r.local_evidence_id !== excludeId && r.status !== 'deleted_pending_sync',
  )
  if (!hit) return { kind: null, existing_evidence_id: null, existing_asset_id: null, reasons: [] }
  return {
    kind: 'exact_duplicate',
    existing_evidence_id: hit.local_evidence_id,
    existing_asset_id: null,
    reasons: ['checksum_match'],
  }
}

export function detectAssetDuplicate(
  sha256: string,
  assets: LocalEvidenceAsset[],
  taskId: string,
  recordsById: Map<string, LocalEvidenceRecord>,
): DuplicateDetectionResult {
  const hit = assets.find((a) => a.sha256 === sha256)
  if (!hit) return { kind: null, existing_evidence_id: null, existing_asset_id: null, reasons: [] }
  const record = recordsById.get(hit.local_evidence_id)
  if (record?.task_id === taskId) {
    return {
      kind: 'exact_duplicate',
      existing_evidence_id: hit.local_evidence_id,
      existing_asset_id: hit.local_asset_id,
      reasons: ['asset_sha256_match_same_task'],
    }
  }
  return {
    kind: 'related_asset',
    existing_evidence_id: hit.local_evidence_id,
    existing_asset_id: hit.local_asset_id,
    reasons: ['asset_sha256_match_other_task'],
  }
}

export function detectPossibleDuplicate(
  candidate: { size_bytes: number; captured_at: string; mime_type: string },
  assets: LocalEvidenceAsset[],
): DuplicateDetectionResult {
  const windowMs = 5_000
  const hit = assets.find((a) => {
    if (a.mime_type !== candidate.mime_type) return false
    if (a.size_bytes !== candidate.size_bytes) return false
    return Math.abs(Date.parse(a.captured_at) - Date.parse(candidate.captured_at)) <= windowMs
  })
  if (!hit) return { kind: null, existing_evidence_id: null, existing_asset_id: null, reasons: [] }
  return {
    kind: 'possible_duplicate',
    existing_evidence_id: hit.local_evidence_id,
    existing_asset_id: hit.local_asset_id,
    reasons: ['size_timestamp_proximity'],
  }
}
