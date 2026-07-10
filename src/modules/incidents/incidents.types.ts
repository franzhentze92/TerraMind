import { createHash } from 'node:crypto'

export type IncidentEntityType = 'fire_event' | string

export type IncidentStatus =
  | 'open'
  | 'monitoring'
  | 'resolved'
  | 'invalidated'
  | 'merged'
  | 'split'

export type IncidentEvidenceStatus =
  | 'single_source'
  | 'multi_event_same_source'
  | 'multi_source'
  | 'field_supported'
  | 'verified'

export type MembershipStatus = 'active' | 'historical' | 'removed' | 'rejected'

export type MembershipRole = 'primary' | 'supporting' | 'related' | 'historical'

export type CorrelationDecision =
  | 'create_new_incident'
  | 'attach_to_existing'
  | 'keep_separate'
  | 'merge_candidate'
  | 'manual_review_recommended'
  | 'no_action'

export interface IncidentEventSnapshot {
  event_type: IncidentEntityType
  event_id: string
  lifecycle_state: string | null
  validation_status: string
  status: string
  department_id: string | null
  department_name: string | null
  centroid_lat: number | null
  centroid_lng: number | null
  first_detected_at: string
  last_detected_at: string
  detection_count: number
  persistence_hours: number | null
  estimated_area_ha: number | null
  source_products: string[]
  attention_score: number | null
  verification_score: number | null
  action_score: number | null
  attention_level: string | null
  verification_level: string | null
  action_level: string | null
  active_incident_id: string | null
  membership_status?: MembershipStatus | null
}

export interface IncidentCandidateSnapshot {
  incident_id: string
  status: IncidentStatus
  primary_event_id: string | null
  centroid_lat: number | null
  centroid_lng: number | null
  first_observed_at: string
  last_observed_at: string
  active_event_count: number
  member_event_ids: string[]
}

export interface CorrelationScoreBreakdown {
  correlation_score: number
  spatial_score: number
  temporal_score: number
  semantic_score: number
  source_diversity_score: number
  lifecycle_compatibility: number
}

export interface CorrelationEvaluationResult {
  event_type: IncidentEntityType
  event_id: string
  correlation_decision: CorrelationDecision
  correlation_model_version: string
  context_signature: string
  evaluated_at: string
  target_incident_id: string | null
  merge_target_incident_id: string | null
  scores: CorrelationScoreBreakdown
  correlation_reasons: string[]
  correlation_limitations: string[]
  rejected_reasons: string[]
  candidates_considered: Array<{
    kind: 'incident' | 'event'
    id: string
    scores: CorrelationScoreBreakdown
    accepted: boolean
  }>
  evidence_snapshot: Record<string, unknown>
  warnings: string[]
  duration_ms: number
}

export interface IncidentPriorityResult {
  attention_score: number
  verification_score: number
  action_score: number
  attention_level: string
  verification_level: string
  action_level: string
  evidence_status: IncidentEvidenceStatus
  priority_explanation: Record<string, unknown>
  priority_limitations: string[]
  dominant_event_id: string | null
  redundant_event_ids: string[]
}

export interface PrimaryEventSelection {
  event_id: string
  event_type: string
  selection_reason: string
  selection_rule: string
  score: number
}

export function hashIncidentSignature(parts: Record<string, unknown>): string {
  const canonical = JSON.stringify(parts, Object.keys(parts).sort())
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16)
}

export function sortEventsDeterministic(
  events: IncidentEventSnapshot[],
): IncidentEventSnapshot[] {
  return [...events].sort((a, b) => a.event_id.localeCompare(b.event_id))
}
