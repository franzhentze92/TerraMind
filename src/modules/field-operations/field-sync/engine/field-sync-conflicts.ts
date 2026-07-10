import type { ConflictClassification } from '@/modules/field-operations/field-sync/field-sync.types'

export interface ConflictDetectionInput {
  conflict_type: string
  message: string
  local_snapshot?: Record<string, unknown>
  remote_snapshot?: Record<string, unknown>
}

const TYPE_TO_CLASSIFICATION: Record<string, ConflictClassification> = {
  mission_cancelled: 'remote_authoritative',
  assignment_withdrawn: 'remote_authoritative',
  package_revoked: 'local_preservation_required',
  requirement_changed: 'requires_refresh',
  plan_superseded: 'requires_refresh',
  submission_exists: 'safe_to_retry',
  checksum_mismatch: 'requires_user_decision',
  bundle_revised_during_sync: 'requires_user_decision',
  asset_deleted_during_upload: 'local_preservation_required',
  permission_denied: 'local_preservation_required',
  url_expired: 'safe_to_retry',
}

export function classifyConflict(conflictType: string): ConflictClassification {
  return TYPE_TO_CLASSIFICATION[conflictType] ?? 'requires_user_decision'
}

export function buildConflict(input: ConflictDetectionInput) {
  return {
    conflict_type: input.conflict_type,
    classification: classifyConflict(input.conflict_type),
    message: input.message,
    local_snapshot: input.local_snapshot ?? {},
    remote_snapshot: input.remote_snapshot ?? {},
    resolved: false,
  }
}

export function isRetryableConflict(classification: ConflictClassification): boolean {
  return classification === 'safe_to_retry'
}
