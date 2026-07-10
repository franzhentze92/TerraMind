export type PopulationJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface PopulationEnrichmentJobRow {
  id: string
  entity_type: string
  entity_id: string
  requested_context_version: string
  status: PopulationJobStatus
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

export interface PopulationJobCounts {
  pending: number
  processing: number
  completed_24h: number
  failed: number
  stale_locks: number
}

export type PopulationJobErrorCode =
  | 'source_unavailable'
  | 'raster_processing_failed'
  | 'invalid_geometry'
  | 'timeout'
  | 'admin_context_unavailable'
  | 'persistence_failed'
  | 'unknown'
