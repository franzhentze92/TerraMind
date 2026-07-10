export type LandCoverJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface LandCoverEnrichmentJobRow {
  id: string
  event_id: string
  requested_context_version: string
  status: LandCoverJobStatus
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

export interface LandCoverJobCounts {
  pending: number
  processing: number
  completed_24h: number
  failed: number
  stale_locks: number
}

export type LandCoverJobErrorCode =
  | 'event_not_found'
  | 'invalid_geometry'
  | 'source_unavailable'
  | 'invalid_context_version'
  | 'gdal_timeout'
  | 'io_transient'
  | 'db_transient'
  | 'processing_failed'
  | 'job_timeout'
