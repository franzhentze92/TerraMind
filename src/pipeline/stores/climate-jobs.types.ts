export type ClimateJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export type ClimateJobErrorCode =
  | 'source_unavailable'
  | 'timeout'
  | 'invalid_geometry'
  | 'version_mismatch'
  | 'unknown'

export interface ClimateEnrichmentJobRow {
  id: string
  entity_type: string
  entity_id: string
  requested_context_version: string
  status: ClimateJobStatus
  priority: number
  attempts: number
  max_attempts: number
  available_at: string
  locked_at: string | null
  locked_by: string | null
  started_at: string | null
  completed_at: string | null
  last_error_code: string | null
  last_error_message: string | null
  created_at: string
  updated_at: string
}

export interface ClimateJobCounts {
  pending: number
  processing: number
  completed_24h: number
  failed: number
  stale_locks: number
}
