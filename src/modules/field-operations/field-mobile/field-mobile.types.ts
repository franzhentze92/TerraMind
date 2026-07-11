export type FieldConnectivityState =
  | 'offline'
  | 'online_no_api'
  | 'session_expired'
  | 'slow_network'
  | 'sync_available'
  | 'sync_in_progress'

export type FieldLocale = 'es' | 'en'

export interface FieldOperationalSummary {
  active_package_id: string | null
  active_mission_id: string | null
  active_mission_title: string | null
  packages_count: number
  pending_tasks: number
  draft_forms: number
  incomplete_evidence_requirements: number
  pending_sync_bundles: number
  paused_or_failed_sessions: number
  open_conflicts: number
  local_storage_bytes: number
  last_sync_at: string | null
  connectivity: FieldConnectivityState
  overall_capture_pct: number
  ready_for_sync_pct: number
  synced_pct: number
  next_action: string
  blocked_reason: string | null
}

export interface SimulatedSyncStep {
  phase: string
  message_key: string
  progress_pct: number
  at: string
}

export interface SimulatedSyncResult {
  ok: boolean
  steps: SimulatedSyncStep[]
  duplicate_submissions: number
  reason?: string
}
