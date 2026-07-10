import { canonicalJson, sha256Hex } from '@/modules/field-operations/offline-evidence/engine/offline-evidence-checksum'
import type { SyncReconciliationResult } from '@/modules/field-operations/field-sync/field-sync.types'

export interface RemoteSubmissionSnapshot {
  submission_id: string
  status: string
  evidence_type: string
  assets: Array<{ id: string; checksum_sha256: string | null; size_bytes: number }>
  has_observation: boolean
  requirement_link_count: number
}

export function reconciliationBody(input: {
  bundle_id: string
  bundle_checksum: string
  submissions: RemoteSubmissionSnapshot[]
}): string {
  return canonicalJson({
    bundle_id: input.bundle_id,
    bundle_checksum: input.bundle_checksum,
    submissions: input.submissions
      .map((s) => ({
        id: s.submission_id,
        status: s.status,
        assets: s.assets.map((a) => ({ id: a.id, sha256: a.checksum_sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
        observation: s.has_observation,
        links: s.requirement_link_count,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  })
}

export function evaluateReconciliation(input: {
  bundle_id: string
  bundle_checksum: string
  expected_record_count: number
  submissions: RemoteSubmissionSnapshot[]
}): SyncReconciliationResult {
  const reasons: string[] = []
  const ready = input.submissions.filter((s) => s.status === 'ready_for_validation')
  const incomplete = input.submissions.filter((s) => s.status === 'incomplete')
  const failed = input.submissions.filter((s) =>
    ['processing_failed', 'unsupported', 'withdrawn'].includes(s.status),
  )

  if (input.submissions.length < input.expected_record_count) {
    reasons.push('missing_submissions')
  }
  if (failed.length > 0) reasons.push('remote_submission_failed')
  if (incomplete.length > 0) reasons.push('remote_submission_incomplete')

  for (const s of input.submissions) {
    const needsAsset = ['georeferenced_photo', 'timestamped_photo', 'video'].includes(s.evidence_type)
    if (needsAsset && s.assets.length === 0) reasons.push(`missing_assets:${s.submission_id}`)
    if (s.evidence_type === 'structured_observation' && !s.has_observation) {
      reasons.push(`missing_observation:${s.submission_id}`)
    }
  }

  const checksum = sha256Hex(
    reconciliationBody({
      bundle_id: input.bundle_id,
      bundle_checksum: input.bundle_checksum,
      submissions: input.submissions,
    }),
  )

  return {
    ok: reasons.length === 0 && ready.length === input.submissions.length && input.submissions.length > 0,
    remote_submission_ids: input.submissions.map((s) => s.submission_id),
    remote_asset_ids: input.submissions.flatMap((s) => s.assets.map((a) => a.id)),
    remote_observation_ids: input.submissions.filter((s) => s.has_observation).map((s) => s.submission_id),
    remote_states: Object.fromEntries(input.submissions.map((s) => [s.submission_id, s.status])),
    reconciliation_checksum: checksum,
    reasons,
  }
}
