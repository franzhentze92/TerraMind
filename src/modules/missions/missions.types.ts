import { createHash } from 'node:crypto'

export const MISSION_TYPES = [
  'remote_analytical_review',
  'satellite_reobservation_request',
  'higher_resolution_imagery_review',
  'local_authority_confirmation_request',
  'protected_area_staff_observation',
  'structured_citizen_evidence_request',
  'field_visual_inspection',
  'georeferenced_photo_collection',
  'drone_observation',
] as const

export type MissionType = (typeof MISSION_TYPES)[number]

export type MissionStatus =
  | 'draft'
  | 'ready'
  | 'approved'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'inconclusive'
  | 'cancelled'
  | 'expired'
  | 'failed'

export type MissionTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'blocked'
  | 'failed'

export type EvidenceRequirementType =
  | 'georeferenced_photo'
  | 'structured_observation'
  | 'timestamped_note'
  | 'satellite_review_result'
  | 'time_series_review_result'
  | 'institutional_response'
  | 'drone_image'
  | 'location_confirmation'

export type MissionCreationDecision =
  | 'create_mission'
  | 'not_eligible'
  | 'duplicate_exists'
  | 'no_action'

export interface MissionPlanNeedSnapshot {
  id: string
  need_type: string
  need_question: string
  priority: number
  recommended_method_id: string | null
  recommended_window: { hours?: number }
  evidence_minimum: string[]
  success_criteria: { text?: string } | string
  inconclusive_criteria: { text?: string } | string
  failure_criteria: { text?: string } | string
  is_blocked?: boolean
}

export interface MissionPlanSnapshot {
  id: string
  incident_id: string
  status: string
  plan_priority: number
  mission_candidate_pending: boolean
  context_signature: string
  recommended_window: { start_hours?: number; end_hours?: number; label?: string }
  incident_snapshot: {
    domain?: string
    incident_status?: string
    centroid_lat?: number | null
    centroid_lng?: number | null
    primary_event_id?: string | null
    last_observed_at?: string
  }
  needs: MissionPlanNeedSnapshot[]
}

export interface MissionTaskDef {
  task_type: string
  sequence: number
  title: string
  instructions: string
  required: boolean
  completion_criteria: string
}

export interface MissionEvidenceDef {
  evidence_type: EvidenceRequirementType
  required: boolean
  minimum_count: number
  required_metadata: string[]
  quality_criteria: string[]
  acceptance_criteria: string
}

export interface MissionTemplateDef {
  mission_type: MissionType
  title_template: string
  objective_template: string
  completion_criteria: string
  inconclusive_criteria: string
  blocking_conditions: string[]
  cancellation_conditions: string[]
  tasks: MissionTaskDef[]
  evidence_requirements: MissionEvidenceDef[]
}

export interface MissionEligibilityResult {
  eligible: boolean
  reasons: string[]
  limitations: string[]
  primary_need: MissionPlanNeedSnapshot | null
  recommended_method_code: string | null
}

export interface MissionCreationResult {
  decision: MissionCreationDecision
  mission_profile_version: string
  context_signature: string
  verification_plan_id: string
  incident_id: string
  mission_id: string | null
  mission_type: MissionType | null
  title: string | null
  objective: string | null
  status: MissionStatus | null
  priority: number
  earliest_start_at: string | null
  due_at: string | null
  expires_at: string | null
  tasks: Array<MissionTaskDef & { status: MissionTaskStatus }>
  evidence_requirements: MissionEvidenceDef[]
  eligibility: MissionEligibilityResult
  reasons: string[]
  limitations: string[]
  warnings: string[]
  evaluated_at: string
  duration_ms: number
}

export function hashMissionSignature(parts: Record<string, unknown>): string {
  const canonical = JSON.stringify(parts, Object.keys(parts).sort())
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16)
}

export function criteriaText(value: { text?: string } | string | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.text ?? ''
}
