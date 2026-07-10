import { createHash } from 'node:crypto'

export const VERIFICATION_NEED_TYPES = [
  'confirm_recent_activity',
  'assess_event_persistence',
  'assess_spatial_extent',
  'obtain_visual_ground_evidence',
  'clarify_land_cover_context',
  'clarify_protected_area_relationship',
  'improve_population_context',
  'differentiate_possible_non_fire_heat_source',
  'verify_incident_resolution',
  'verify_reactivation',
] as const

export type VerificationNeedType = (typeof VERIFICATION_NEED_TYPES)[number]

export type VerificationPlanStatus =
  | 'draft'
  | 'ready'
  | 'not_required'
  | 'blocked'
  | 'superseded'
  | 'satisfied'
  | 'cancelled'

export type CostBand = 'negligible' | 'low' | 'medium' | 'high' | 'unknown'
export type TimeBand = 'minutes' | 'hours' | 'same_day' | 'multi_day' | 'unknown'
export type MethodAvailability = 'available' | 'limited' | 'unavailable' | 'unknown'

export interface VerificationMethodDef {
  method_id: string
  method_type: 'remote_analytical' | 'remote_human' | 'field'
  label: string
  supported_need_types: VerificationNeedType[]
  expected_information_gain: number
  estimated_cost_band: CostBand
  estimated_time_band: TimeBand
  requires_field_presence: boolean
  requires_human_review: boolean
  requires_external_provider: boolean
  availability_status: MethodAvailability
  evidence_strength: number
  geographic_constraints: string[]
  weather_constraints: string[]
  safety_constraints: string[]
  prerequisites: string[]
  limitations: string[]
}

export interface VerificationNeedDef {
  need_type: VerificationNeedType
  question: string
  evidence_minimum: string[]
  success_criteria: string
  inconclusive_criteria: string
  failure_criteria: string
  default_window_hours: number
}

export interface IncidentVerificationSnapshot {
  incident_id: string
  incident_status: string
  incident_type: string
  domain: string
  evidence_status: string
  verification_score: number
  verification_level: string
  attention_score: number
  action_score: number
  action_level: string
  plan_limitations: string[]
  priority_limitations: string[]
  first_observed_at: string
  last_observed_at: string
  primary_event_id: string | null
  active_event_count: number
  event_count: number
  members: Array<{
    event_id: string
    lifecycle_state: string | null
    last_detected_at: string
    attention_score: number | null
    verification_score: number | null
    source_products: string[]
    context_availability: Record<string, string>
    finding_limitations: string[]
  }>
  component_evidence_states: Array<{ component: string; state: string; note: string }>
  active_findings: Array<{
    finding_type: string
    limitations: string[]
    confidence_level: string
  }>
}

export interface DerivedVerificationNeed {
  need_type: VerificationNeedType
  need_question: string
  priority: number
  derivation_reasons: string[]
  evidence_minimum: string[]
  success_criteria: string
  inconclusive_criteria: string
  failure_criteria: string
  recommended_window_hours: number
}

export interface RankedMethodCandidate {
  method_id: string
  method_type: string
  is_recommended: boolean
  is_alternative: boolean
  is_blocked: boolean
  suitability_score: number
  information_gain_score: number
  urgency_fit_score: number
  cost_efficiency_score: number
  availability_score: number
  evidence_strength_score: number
  ranking_reasons: string[]
  ranking_limitations: string[]
  constraints: string[]
}

export interface VerificationPlanResult {
  incident_id: string
  status: VerificationPlanStatus
  verification_model_version: string
  context_signature: string
  evaluated_at: string
  plan_priority: number
  plan_reasons: string[]
  plan_limitations: string[]
  recommended_window: { start_hours: number; end_hours: number; label: string }
  incident_snapshot: IncidentVerificationSnapshot
  needs: Array<
    DerivedVerificationNeed & {
      recommended_method: RankedMethodCandidate | null
      alternative_methods: RankedMethodCandidate[]
      selection_reason: string
    }
  >
  mission_candidate_pending: boolean
  warnings: string[]
  duration_ms: number
}

export function hashVerificationSignature(parts: Record<string, unknown>): string {
  const canonical = JSON.stringify(parts, Object.keys(parts).sort())
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16)
}

export function sortNeedsDeterministic(
  needs: DerivedVerificationNeed[],
): DerivedVerificationNeed[] {
  return [...needs].sort((a, b) => {
    const p = b.priority - a.priority
    if (p !== 0) return p
    return a.need_type.localeCompare(b.need_type)
  })
}
