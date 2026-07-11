import { createHash } from 'node:crypto'

export const RESPONSE_MODEL_ID = 'fire-response-orchestration'
export const RESPONSE_MODEL_VERSION = '1.0.0'

export const RESPONSE_LEVELS = [
  'no_response_required',
  'continue_monitoring',
  'request_additional_verification',
  'prepare_internal_response',
  'coordinate_with_responsible_party',
  'operational_follow_up',
  'escalate_for_authorized_review',
] as const
export type ResponseLevel = (typeof RESPONSE_LEVELS)[number]

export const RESPONSE_URGENCIES = [
  'routine',
  'watch',
  'timely_review',
  'prompt_review',
  'urgent_authorized_review',
] as const
export type ResponseUrgency = (typeof RESPONSE_URGENCIES)[number]

export const CLOSURE_RECOMMENDATIONS = [
  'closure_not_recommended',
  'continue_monitoring_before_closure',
  'closure_review_recommended',
] as const
export type ClosureRecommendation = (typeof CLOSURE_RECOMMENDATIONS)[number]

export const ASSESSMENT_STATUSES = [
  'waiting_for_reevaluation',
  'ready_for_assessment',
  'blocked_inconsistent_snapshot',
  'recommended',
  'superseded',
] as const
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number]

export const DECISION_STATUSES = [
  'recommended',
  'pending_review',
  'approved',
  'modified',
  'rejected',
  'superseded',
  'executing',
  'completed',
  'cancelled',
] as const
export type DecisionStatus = (typeof DECISION_STATUSES)[number]

export const ACTION_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'executing',
  'completed',
  'failed',
  'cancelled',
  'superseded',
] as const
export type ActionStatus = (typeof ACTION_STATUSES)[number]

export const NOTIFICATION_DIRECTIVE_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'sent',
  'cancelled',
] as const
export type NotificationDirectiveStatus = (typeof NOTIFICATION_DIRECTIVE_STATUSES)[number]

export const RESPONSE_ACTION_TYPES = [
  'continue_monitoring',
  'schedule_reassessment',
  'request_additional_mission',
  'request_specialist_review',
  'prepare_internal_brief',
  'notify_internal_operations',
  'coordinate_external_review',
  'maintain_incident_open',
  'recommend_incident_closure',
  'recommend_event_reclassification',
  'recommend_observation_invalidation',
  'close_as_non_actionable',
] as const
export type ResponseActionType = (typeof RESPONSE_ACTION_TYPES)[number]

export interface IncidentSnapshot {
  incident_id: string
  incident_version: number
  status: string
  last_observed_at: string | null
  organization_id: string
}

export interface LifecycleSnapshot {
  lifecycle_state: string
  validation_status: string
  last_detected_at: string | null
  inactive_since: string | null
  persistence_hours: number
  version_signature: string
}

export interface FindingSnapshot {
  finding_id: string
  finding_code: string
  finding_type: string
  summary: string
  version_signature: string
}

export interface PrioritySnapshot {
  attention_score: number
  verification_score: number
  action_score: number
  priority_band: string
  version_signature: string
}

export interface VerificationPlanSnapshot {
  plan_id: string
  status: string
  open_needs_count: number
  version_signature: string
}

export interface VerificationResolutionSnapshot {
  resolution_id: string
  plan_id: string
  plan_status: string
  need_resolutions: Array<{ need_id: string; need_type: string; status: string }>
  satisfied_count: number
  inconclusive_count: number
  conflicting_count: number
  remaining_uncertainties: string[]
  resolution_limitations: string[]
  downstream_effects: string[]
  combined_strength: string
  has_material_conflict: boolean
  non_vegetation_heat_indicated: boolean
  recent_vegetation_activity_indicated: boolean
  mission_completed_without_evidence: boolean
  version_signature: string
}

export interface EvidenceValidationSummary {
  validated_count: number
  strong_count: number
  limited_count: number
  weak_count: number
  conflicting_count: number
  combined_strength: string
  independent_sources: number
}

export interface MissionOutcomeSummary {
  mission_id: string | null
  status: string
  completed_at: string | null
  evidence_submitted: boolean
}

export interface TerritorialContextSnapshot {
  in_protected_area: boolean
  population_exposure_level: 'none' | 'low' | 'moderate' | 'high' | 'unknown'
  land_cover_context: string | null
  climate_stress_indicator: 'none' | 'moderate' | 'elevated' | 'unknown'
}

export interface ReevaluationCompletionSnapshot {
  lifecycle_complete: boolean
  findings_complete: boolean
  priority_complete: boolean
  incident_correlation_complete: boolean
  verification_plan_complete: boolean
  pending_effect_types: string[]
  snapshot_versions: {
    lifecycle: string
    findings: string
    priority: string
    incident: string
    resolution: string
  }
}

export interface ResponseOrchestrationInput {
  organizationId: string
  incident: IncidentSnapshot
  lifecycle: LifecycleSnapshot
  findings: FindingSnapshot[]
  priority: PrioritySnapshot
  verificationPlan?: VerificationPlanSnapshot
  verificationResolution: VerificationResolutionSnapshot
  evidenceSummary: EvidenceValidationSummary
  missionSummary?: MissionOutcomeSummary
  territorialContext: TerritorialContextSnapshot
  reevaluationState: ReevaluationCompletionSnapshot
  evaluated_at: string
}

export interface BlockingUncertainty {
  code: string
  description: string
  blocks_actions: ResponseActionType[]
}

export interface RecommendedAction {
  action_type: ResponseActionType
  rationale_code: string
  execution_mode: 'manual' | 'auto_draft' | 'auto_execute'
  requires_approval: boolean
  priority: number
}

export interface ProhibitedAction {
  action_type: ResponseActionType
  reason_code: string
}

export interface AuthorityRequirement {
  level: 'automatic' | 'coordinator' | 'supervisor' | 'analyst' | 'authorized_reviewer'
  permission: string
  rationale_code: string
}

export interface ResponseOrchestrationOutput {
  recommendedResponseLevel: ResponseLevel
  urgency: ResponseUrgency
  rationaleCodes: string[]
  blockingUncertainties: BlockingUncertainty[]
  recommendedActions: RecommendedAction[]
  prohibitedActions: ProhibitedAction[]
  requiredAuthority: AuthorityRequirement
  closureRecommendation: ClosureRecommendation
  reassessmentAt?: string
  assessmentStatus: AssessmentStatus
  inputSignature: string
  outputSignature: string
  decisionRules: string[]
}

export interface InternalResponseBriefing {
  incidentSummary: Record<string, unknown>
  observationSummary: Record<string, unknown>
  findingSummary: Record<string, unknown>
  prioritySummary: Record<string, unknown>
  verificationSummary: Record<string, unknown>
  evidenceSummary: Record<string, unknown>
  residualUncertainty: string[]
  recommendedResponse: Record<string, unknown>
  decision?: Record<string, unknown>
  actions: Array<Record<string, unknown>>
  nextMilestones: string[]
}

export function hashResponseContext(parts: Record<string, unknown>): string {
  const canonical = JSON.stringify(parts, Object.keys(parts).sort())
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32)
}

export function buildAssessmentIdempotencyKey(input: {
  organizationId: string
  incidentId: string
  incidentVersion: number
  resolutionSignature: string
  reevaluationSignature: string
  modelVersion: string
}): string {
  return hashResponseContext(input as unknown as Record<string, unknown>)
}
