export type BiodiversityJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export type BiodiversityJobErrorCode =
  | 'source_unavailable'
  | 'timeout'
  | 'version_mismatch'
  | 'invalid_geometry'
  | 'unknown'

export interface BiodiversityEnrichmentJobRow {
  id: string
  entity_type: string
  entity_id: string
  requested_context_version: string
  status: BiodiversityJobStatus
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

export interface BiodiversityJobCounts {
  pending: number
  processing: number
  completed: number
  failed: number
}
