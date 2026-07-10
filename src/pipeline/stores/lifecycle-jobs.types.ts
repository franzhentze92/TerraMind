export interface LifecycleEvaluationJobRow {
  id: string
  entity_type: string
  entity_id: string
  requested_lifecycle_model_version: string
  requested_context_signature: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
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
