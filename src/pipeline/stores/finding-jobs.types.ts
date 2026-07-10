export type FindingJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface FindingEvaluationJobRow {
  id: string
  entity_type: string
  entity_id: string
  requested_rule_set_version: string
  requested_context_version: string | null
  status: FindingJobStatus
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
