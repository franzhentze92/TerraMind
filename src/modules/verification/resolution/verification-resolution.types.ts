import { createHash } from 'node:crypto'

export const RESOLUTION_MODEL_VERSION = '1.0.0'

export const NEED_RESOLUTION_STATUSES = [
  'open',
  'partially_satisfied',
  'satisfied',
  'inconclusive',
  'insufficient_evidence',
  'conflicting_evidence',
  'blocked',
  'superseded',
  'cancelled',
] as const

export type NeedResolutionStatus = (typeof NEED_RESOLUTION_STATUSES)[number]

export const PLAN_RESOLUTION_STATUSES = [
  'draft',
  'ready',
  'in_progress',
  'partially_satisfied',
  'satisfied',
  'inconclusive',
  'blocked',
  'not_required',
  'superseded',
  'cancelled',
] as const

export type CorroborationLevel =
  | 'single_evidence'
  | 'multiple_correlated_evidence'
  | 'multiple_independent_evidence'
  | 'cross_method_evidence'

export type ConflictAssessmentStatus =
  | 'none'
  | 'material_conflict'
  | 'explainable_difference'
  | 'insufficient_context'
  | 'unresolved_conflict'

export interface ValidatedEvidenceItem {
  submission_id: string
  validation_id: string
  evidence_type: string
  validation_status: string
  evidence_strength: string
  overall_quality_score: number
  temporal_relevance_score: number
  spatial_relevance_score: number
  source_independence_score: number
  submitted_by_id: string
  source_type: string
  source_device: string | null
  captured_at: string | null
  verification_need_id: string | null
  requirement_ids: string[]
  valid_coverage_status: string | null
  limitations: string[]
  observation: Record<string, unknown> | null
}

export interface MissionOutcomeSnapshot {
  mission_id: string
  status: string
  mission_type: string
  verification_need_id: string | null
  completed_at: string | null
}

export interface ResolutionConflictInput {
  submission_id_a: string
  submission_id_b: string
  conflict_type: string
  conflict_field: string | null
  description: string
  captured_at_a: string | null
  captured_at_b: string | null
}

export interface EvidenceBundle {
  submissions_considered: string[]
  validations_used: string[]
  submissions_discarded: Array<{ submission_id: string; reason: string }>
  independent_sources: string[]
  corroboration_level: CorroborationLevel
  combined_strength: string
  temporal_coverage: { earliest: string | null; latest: string | null }
  spatial_coverage_note: string
  contradictions: string[]
  limitations: string[]
}

export interface NeedResolutionSnapshot {
  need_id: string
  need_type: string
  need_question: string
  need_priority: number
  plan_id: string
  plan_status: string
  incident_id: string
  incident_status: string
  incident_last_observed_at: string | null
  recommended_window_hours: number
  validated_evidence: ValidatedEvidenceItem[]
  mission_outcomes: MissionOutcomeSnapshot[]
  conflicts: ResolutionConflictInput[]
  previous_resolution_status: NeedResolutionStatus
}

export interface NeedResolutionScores {
  evidence_sufficiency_score: number
  coverage_score: number
  corroboration_score: number
  conflict_penalty: number
  temporal_fit_score: number
  spatial_fit_score: number
  resolution_confidence_score: number
}

export interface NeedResolutionResult {
  ok: boolean
  resolution_status: NeedResolutionStatus
  resolution_confidence: number
  resolution_strength: string
  resolution_reasons: string[]
  resolution_limitations: string[]
  remaining_uncertainties: string[]
  recommended_follow_up: string[]
  alternative_method_recommended: string | null
  evidence_bundle: EvidenceBundle
  requirements_coverage: Array<{
    requirement_id: string
    coverage_status: string
    reason: string
  }>
  conflict_assessment: {
    status: ConflictAssessmentStatus
    reasons: string[]
  }
  scores: NeedResolutionScores
  decision_rules: string[]
  downstream_effects: string[]
  context_signature: string
  warnings: string[]
}

export interface PlanResolutionSummary {
  plan_id: string
  derived_status: string
  need_resolutions: Array<{ need_id: string; need_type: string; status: NeedResolutionStatus }>
  satisfied_count: number
  open_count: number
  inconclusive_count: number
  conflicting_count: number
  reasons: string[]
}

export function hashResolutionContext(parts: Record<string, unknown>): string {
  const canonical = JSON.stringify(parts, Object.keys(parts).sort())
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32)
}
