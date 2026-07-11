import type { ResponseActionType } from '@/modules/response-orchestration/response-orchestration.types'

export const FIRE_RESPONSE_MODEL_VERSION = '1.0.0'

export const LOW_RISK_AUTO_ACTIONS: ResponseActionType[] = [
  'continue_monitoring',
  'schedule_reassessment',
  'prepare_internal_brief',
  'maintain_incident_open',
]

export const HIGH_RISK_ACTIONS: ResponseActionType[] = [
  'request_additional_mission',
  'coordinate_external_review',
  'recommend_incident_closure',
  'recommend_event_reclassification',
  'recommend_observation_invalidation',
  'close_as_non_actionable',
  'notify_internal_operations',
]

export const REEVALUATION_EFFECT_TYPES = [
  'finding_reevaluation_requested',
  'priority_reevaluation_requested',
  'lifecycle_reevaluation_requested',
  'incident_reevaluation_requested',
  'verification_replanning_requested',
] as const

export const REASSESSMENT_INTERVALS_HOURS = {
  routine: 72,
  watch: 48,
  limited_evidence: 24,
  conflict: 12,
} as const

export const MARGINAL_VERIFICATION_RULES = {
  min_unresolved_questions: 1,
  require_response_level_change: true,
  block_repeat_within_hours: 24,
} as const

/** Fixtures sintéticos — solo pruebas */
export const SYNTHETIC_RESPONSE_FIXTURES = {
  organization_id: 'org-e2e',
  incident_id: 'inc-e2e',
  resolution_id: 'res-e2e',
}
