import { assertSafeMissionCopy } from '@/modules/missions/missions-copy-guard'
import {
  FIRE_MISSION_DOMAIN,
  FIRE_MISSION_PROFILE_VERSION,
  FIRE_MISSION_TEMPLATES,
  METHOD_TO_MISSION_TYPE,
  MISSION_INITIAL_STATUS,
  MISSION_PRIORITY_WEIGHTS,
  NEED_TYPE_LABELS,
} from '@/modules/missions/config/fire-mission.config'
import { evaluateMissionEligibility } from '@/modules/missions/engine/mission-eligibility.engine'
import {
  criteriaText,
  hashMissionSignature,
  type MissionCreationResult,
  type MissionPlanSnapshot,
  type MissionType,
} from '@/modules/missions/missions.types'

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '')
}

function computeMissionWindow(
  plan: MissionPlanSnapshot,
  needWindowHours: number,
  evaluatedAt: string,
): { earliest_start_at: string; due_at: string; expires_at: string } {
  const start = new Date(evaluatedAt)
  const endHours = Math.max(
    needWindowHours,
    plan.recommended_window.end_hours ?? needWindowHours,
    24,
  )
  const due = new Date(start.getTime() + endHours * 3_600_000)
  const expires = new Date(due.getTime() + endHours * 0.5 * 3_600_000)
  return {
    earliest_start_at: start.toISOString(),
    due_at: due.toISOString(),
    expires_at: expires.toISOString(),
  }
}

function computeMissionPriority(plan: MissionPlanSnapshot, needPriority: number): number {
  const planComponent = plan.plan_priority * MISSION_PRIORITY_WEIGHTS.plan_priority
  const needComponent = needPriority * 0.3 * MISSION_PRIORITY_WEIGHTS.plan_priority
  const decayComponent =
    (plan.incident_snapshot.last_observed_at
      ? 20
      : 10) * MISSION_PRIORITY_WEIGHTS.evidence_decay
  const lifecycleComponent =
    plan.incident_snapshot.incident_status === 'open'
      ? 15 * MISSION_PRIORITY_WEIGHTS.lifecycle
      : 5 * MISSION_PRIORITY_WEIGHTS.lifecycle
  return Math.min(
    100,
    Math.round(planComponent + needComponent + decayComponent + lifecycleComponent),
  )
}

export function buildMissionContextSignature(input: {
  plan: MissionPlanSnapshot
  primaryNeedId: string
  methodCode: string
}): string {
  return hashMissionSignature({
    profile: FIRE_MISSION_PROFILE_VERSION,
    plan_id: input.plan.id,
    plan_signature: input.plan.context_signature,
    primary_need_id: input.primaryNeedId,
    method_code: input.methodCode,
  })
}

export function evaluateMissionCreation(input: {
  plan: MissionPlanSnapshot
  blockedMethodIds?: Set<string>
  evaluatedAt: string
}): MissionCreationResult {
  const started = Date.now()
  const eligibility = evaluateMissionEligibility(input.plan, input.blockedMethodIds)

  if (!eligibility.eligible || !eligibility.primary_need || !eligibility.recommended_method_code) {
    const reasons = eligibility.reasons
    for (const r of reasons) assertSafeMissionCopy(r)
    return {
      decision: 'not_eligible',
      mission_profile_version: FIRE_MISSION_PROFILE_VERSION,
      context_signature: buildMissionContextSignature({
        plan: input.plan,
        primaryNeedId: eligibility.primary_need?.id ?? 'none',
        methodCode: eligibility.recommended_method_code ?? 'none',
      }),
      verification_plan_id: input.plan.id,
      incident_id: input.plan.incident_id,
      mission_id: null,
      mission_type: null,
      title: null,
      objective: null,
      status: null,
      priority: 0,
      earliest_start_at: null,
      due_at: null,
      expires_at: null,
      tasks: [],
      evidence_requirements: [],
      eligibility,
      reasons,
      limitations: eligibility.limitations,
      warnings: [],
      evaluated_at: input.evaluatedAt,
      duration_ms: Date.now() - started,
    }
  }

  const primaryNeed = eligibility.primary_need
  const methodCode = eligibility.recommended_method_code
  const missionType = (METHOD_TO_MISSION_TYPE[methodCode] ??
    'remote_analytical_review') as MissionType
  const template =
    FIRE_MISSION_TEMPLATES[missionType] ?? FIRE_MISSION_TEMPLATES.remote_analytical_review

  const needLabel = NEED_TYPE_LABELS[primaryNeed.need_type] ?? primaryNeed.need_type
  const title = fillTemplate(template.title_template, {
    need_label: needLabel,
    need_question: primaryNeed.need_question,
  })
  const objective = fillTemplate(template.objective_template, {
    need_label: needLabel,
    need_question: primaryNeed.need_question,
  })

  const contextSignature = buildMissionContextSignature({
    plan: input.plan,
    primaryNeedId: primaryNeed.id,
    methodCode,
  })

  const windowHours = primaryNeed.recommended_window?.hours ?? 48
  const window = computeMissionWindow(input.plan, windowHours, input.evaluatedAt)
  const priority = computeMissionPriority(input.plan, primaryNeed.priority)

  const tasks = template.tasks.map((t) => ({
    ...t,
    status: 'pending' as const,
  }))

  const evidenceRequirements = template.evidence_requirements.map((e) => ({ ...e }))

  const reasons = [
    ...eligibility.reasons,
    `Tipo de misión: ${missionType}`,
    `Método: ${methodCode}`,
  ]
  const limitations = [
    ...eligibility.limitations,
    'Completar la misión no verifica automáticamente el incidente',
  ]

  for (const r of reasons) assertSafeMissionCopy(r)
  for (const l of limitations) assertSafeMissionCopy(l)
  assertSafeMissionCopy(title)
  assertSafeMissionCopy(objective)
  assertSafeMissionCopy(template.completion_criteria)
  assertSafeMissionCopy(template.inconclusive_criteria)

  return {
    decision: 'create_mission',
    mission_profile_version: FIRE_MISSION_PROFILE_VERSION,
    context_signature: contextSignature,
    verification_plan_id: input.plan.id,
    incident_id: input.plan.incident_id,
    mission_id: null,
    mission_type: missionType,
    title,
    objective,
    status: MISSION_INITIAL_STATUS,
    priority,
    earliest_start_at: window.earliest_start_at,
    due_at: window.due_at,
    expires_at: window.expires_at,
    tasks,
    evidence_requirements: evidenceRequirements,
    eligibility,
    reasons,
    limitations,
    warnings: [],
    evaluated_at: input.evaluatedAt,
    duration_ms: Date.now() - started,
    // extended fields for persistence via cast
    ...({
      primary_verification_need_id: primaryNeed.id,
      recommended_method_code: methodCode,
      completion_criteria: template.completion_criteria,
      inconclusive_criteria: template.inconclusive_criteria,
      blocking_conditions: template.blocking_conditions,
      cancellation_conditions: template.cancellation_conditions,
      need_success_criteria: criteriaText(primaryNeed.success_criteria),
      need_inconclusive_criteria: criteriaText(primaryNeed.inconclusive_criteria),
      location_description:
        input.plan.incident_snapshot.centroid_lat != null
          ? `Área del incidente (${input.plan.incident_snapshot.centroid_lat}, ${input.plan.incident_snapshot.centroid_lng})`
          : 'Área del incidente sin centroid definido',
      location_geometry:
        input.plan.incident_snapshot.centroid_lat != null
          ? {
              type: 'Point',
              coordinates: [
                input.plan.incident_snapshot.centroid_lng,
                input.plan.incident_snapshot.centroid_lat,
              ],
            }
          : null,
    } as Record<string, unknown>),
  }
}

export const genericMissionsCoreEngine = {
  evaluate: evaluateMissionCreation,
  profileVersion: FIRE_MISSION_PROFILE_VERSION,
  buildContextSignature: buildMissionContextSignature,
  domain: FIRE_MISSION_DOMAIN,
}
