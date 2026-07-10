export const FIRE_FIELD_SYNC_MODEL_VERSION = '1.0.0'

export const SYNC_STATUSES = [
  'pending_sync',
  'sync_queued',
  'syncing',
  'partially_synced',
  'sync_blocked',
  'conflict',
  'synced',
  'remote_rejected',
  'retry_scheduled',
  'cancelled',
] as const

export type SyncStatus = (typeof SYNC_STATUSES)[number]

export const SYNC_OPERATION_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'failed',
  'skipped',
  'blocked',
] as const

export type SyncOperationStatus = (typeof SYNC_OPERATION_STATUSES)[number]

export const SYNC_OPERATION_TYPES = [
  'validate_bundle',
  'register_bundle',
  'create_submission',
  'start_upload',
  'transfer_asset',
  'confirm_asset',
  'create_observation',
  'link_requirement',
  'await_processing',
  'reconcile',
  'mark_synced',
] as const

export type SyncOperationType = (typeof SYNC_OPERATION_TYPES)[number]

export const CONFLICT_CLASSIFICATIONS = [
  'safe_to_retry',
  'requires_refresh',
  'requires_user_decision',
  'remote_authoritative',
  'local_preservation_required',
] as const

export type ConflictClassification = (typeof CONFLICT_CLASSIFICATIONS)[number]

export const ERROR_CLASSIFICATIONS = ['transient', 'permanent'] as const
export type ErrorClassification = (typeof ERROR_CLASSIFICATIONS)[number]

export interface SyncSession {
  session_id: string
  bundle_id: string
  bundle_checksum: string
  package_id: string
  package_version: number
  mission_id: string
  task_id: string
  status: SyncStatus
  tab_id: string | null
  attempt: number
  max_attempts: number
  next_retry_at: string | null
  last_error: string | null
  error_classification: ErrorClassification | null
  bytes_total: number
  bytes_transferred: number
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
  paused: boolean
  cancelled: boolean
}

export interface SyncOperation {
  operation_id: string
  session_id: string
  bundle_id: string
  local_evidence_id: string | null
  local_asset_id: string | null
  operation_type: SyncOperationType
  status: SyncOperationStatus
  attempt: number
  idempotency_key: string
  remote_submission_id: string | null
  remote_asset_id: string | null
  bytes_transferred: number
  local_checksum: string | null
  remote_checksum: string | null
  error: string | null
  next_retry_at: string | null
  created_at: string
  updated_at: string
}

export interface AssetUploadSession {
  upload_session_id: string
  sync_session_id: string
  operation_id: string
  local_asset_id: string
  local_evidence_id: string
  remote_submission_id: string
  remote_upload_session_id: string | null
  storage_path: string | null
  upload_url: string | null
  upload_url_expires_at: string | null
  mime_type: string
  original_filename: string
  expected_size_bytes: number
  expected_checksum_sha256: string
  bytes_transferred: number
  status: 'pending' | 'uploading' | 'uploaded' | 'confirmed' | 'expired' | 'failed'
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface SyncConflict {
  conflict_id: string
  session_id: string
  bundle_id: string
  conflict_type: string
  classification: ConflictClassification
  message: string
  local_snapshot: Record<string, unknown>
  remote_snapshot: Record<string, unknown>
  resolved: boolean
  created_at: string
}

export interface RemoteObjectMapping {
  mapping_id: string
  bundle_id: string
  bundle_checksum: string
  local_evidence_id: string
  local_asset_id: string | null
  remote_submission_id: string
  remote_asset_id: string | null
  remote_observation_id: string | null
  synced_at: string | null
  remote_state: string | null
  reconciliation_checksum: string | null
  created_at: string
  updated_at: string
}

export interface SyncReconciliationResult {
  ok: boolean
  remote_submission_ids: string[]
  remote_asset_ids: string[]
  remote_observation_ids: string[]
  remote_states: Record<string, string>
  reconciliation_checksum: string
  reasons: string[]
}

export interface SyncProgressSummary {
  session: SyncSession
  operations: SyncOperation[]
  upload_sessions: AssetUploadSession[]
  conflicts: SyncConflict[]
  mappings: RemoteObjectMapping[]
  progress_pct: number
}
