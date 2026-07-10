export interface IncidentCorrelationJobRow {
  id: string
  event_type: string
  event_id: string
  requested_correlation_model_version: string
  requested_context_signature: string | null
  status: string
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
