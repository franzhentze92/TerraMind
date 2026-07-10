import type { CompositeFinding, FindingDomain, FireFindingType } from '@/modules/findings/findings.types'

export type PriorityAssessmentStatus = 'active' | 'superseded' | 'expired'

export type AttentionLevel =
  | 'routine'
  | 'monitor'
  | 'review'
  | 'high_attention'
  | 'priority_attention'

export type VerificationLevel = 'not_required' | 'useful' | 'recommended' | 'high_priority'

export type ActionLevel = 'none' | 'prepare' | 'coordinate' | 'operational_attention'

export type EvidenceContributionState =
  | 'supporting_evidence'
  | 'negative_evidence'
  | 'missing_context'
  | 'uncertain_context'
  | 'not_applicable'

export interface FindingContributionRecord {
  finding_id: string
  finding_type: FireFindingType | string
  rule_code: string
  domain: FindingDomain | 'composite' | 'persistence'
  state: EvidenceContributionState
  raw_contribution: number
  accepted_contribution: number
  dimensions: {
    severity: number
    urgency: number
    exposure: number
    sensitivity: number
    persistence: number
    verification: number
  }
  discard_reason?: string
}

export interface DomainContributionSummary {
  domain: FindingDomain | 'composite' | 'persistence'
  raw_total: number
  accepted_total: number
  cap: number
  capped_amount: number
  findings: string[]
}

export interface ScoreExplanation {
  dimension_base: {
    severity: number
    urgency: number
    exposure: number
    sensitivity: number
    persistence: number
  }
  domain_contributions: DomainContributionSummary[]
  discarded_by_redundancy: Array<{
    finding_type: string
    reason: string
    would_have_contributed: number
  }>
  dominance_substitution_applied: Array<{
    dominant: string
    subsumed: string
  }>
  concurrency_bonus: {
    applied: boolean
    raw_bonus: number
    accepted_bonus: number
    cap: number
    explanation: string
  }
  decay: {
    applied: boolean
    hours_since_last_detection: number
    decay_points: number
    profile: string
  }
  confidence_modifiers: {
    evidence_reliability_modifier: number
    uncertainty_modifier: number
    action_cap: number
    reasons: string[]
  }
  component_evidence_states: Array<{
    component: string
    state: EvidenceContributionState
    note: string
  }>
  raw_base_priority: number
  adjusted_base_priority: number
  attention_score_final: number
  verification_score_final: number
  action_score_final: number
}

export interface FindingSnapshotEntry {
  finding_id: string
  finding_type: string
  title: string
  severity_label: string
  confidence_level: string
  contributed: boolean
  contribution_state: EvidenceContributionState
  accepted_contribution: number
  discard_reason?: string
}

export interface PriorityScoreDelta {
  attention_delta: number
  verification_delta: number
  action_delta: number
}

export interface PriorityLevelChange {
  attention?: { from: AttentionLevel; to: AttentionLevel }
  verification?: { from: VerificationLevel; to: VerificationLevel }
  action?: { from: ActionLevel; to: ActionLevel }
}

export interface PriorityAssessment {
  id?: string
  entity_type: string
  entity_id: string
  assessment_status: PriorityAssessmentStatus
  attention_score: number
  action_score: number
  verification_score: number
  attention_level: AttentionLevel
  action_level: ActionLevel
  verification_level: VerificationLevel
  severity_component: number
  urgency_component: number
  exposure_component: number
  sensitivity_component: number
  confidence_component: number
  persistence_component: number
  domain_contributions: Record<string, number>
  score_explanation: ScoreExplanation
  priority_reasons: string[]
  priority_limitations: string[]
  recommended_next_step: string
  finding_snapshot: FindingSnapshotEntry[]
  context_version: string
  rule_set_version: string
  priority_model_version: string
  previous_assessment_id?: string | null
  score_delta: PriorityScoreDelta
  level_change: PriorityLevelChange
  change_reasons: string[]
  evaluated_at: string
  valid_until: string
}

export interface FirePriorityEventContext {
  id: string
  department_code: string | null
  department_name: string | null
  status: string
  validation_status: string
  detection_count: number
  first_detected_at: string
  last_detected_at: string
  persistence_hours: number | null
  context_availability: {
    protected_area: 'complete' | 'partial' | 'missing' | 'unavailable'
    land_cover: 'complete' | 'partial' | 'missing' | 'unavailable'
    population: 'complete' | 'partial' | 'missing' | 'unavailable'
    climate: 'complete' | 'partial' | 'missing' | 'unavailable'
    biodiversity: 'complete' | 'partial' | 'missing' | 'unavailable'
  }
  context_version: string
  rule_set_version: string
}

export interface PriorityEvaluationInput {
  entity_type: string
  entity_id: string
  event: FirePriorityEventContext
  findings: CompositeFinding[]
  evaluated_at: string
  previous_assessment?: PriorityAssessment | null
}

export interface PriorityEvaluationResult {
  entity_type: string
  entity_id: string
  assessment: PriorityAssessment
  findings_count: number
  assessment_created: number
  assessment_updated: number
  assessment_superseded: number
  warnings: string[]
  duration_ms: number
}
