import {
  REASSESSMENT_INTERVALS_HOURS,
  MARGINAL_VERIFICATION_RULES,
} from '@/modules/response-orchestration/config/fire-response-orchestration.config'
import { getAuthorityForAction } from '@/modules/response-orchestration/config/response-orchestration-authority.config'
import type {
  AuthorityRequirement,
  BlockingUncertainty,
  ClosureRecommendation,
  ProhibitedAction,
  RecommendedAction,
  ResponseActionType,
  ResponseLevel,
  ResponseOrchestrationInput,
  ResponseOrchestrationOutput,
  ResponseUrgency,
} from '@/modules/response-orchestration/response-orchestration.types'
import { hashResponseContext } from '@/modules/response-orchestration/response-orchestration.types'
import { evaluateReevaluationGate } from '@/modules/response-orchestration/engine/reevaluation-completion.gate'

function hoursSince(iso: string | null, nowIso: string): number | null {
  if (!iso) return null
  return (Date.parse(nowIso) - Date.parse(iso)) / 3_600_000
}

function deriveUrgency(input: ResponseOrchestrationInput, level: ResponseLevel): ResponseUrgency {
  const vr = input.verificationResolution
  if (vr.has_material_conflict) return 'urgent_authorized_review'
  if (vr.conflicting_count > 0) return 'prompt_review'
  if (level === 'escalate_for_authorized_review') return 'prompt_review'
  if (level === 'operational_follow_up') return 'timely_review'
  if (input.priority.action_score >= 50) return 'timely_review'
  if (input.evidenceSummary.limited_count > 0 || vr.inconclusive_count > 0) return 'watch'
  return 'routine'
}

function shouldRecommendAdditionalMission(input: ResponseOrchestrationInput): boolean {
  const vr = input.verificationResolution
  if (vr.mission_completed_without_evidence) return false
  if (vr.has_material_conflict) return false
  if (vr.satisfied_count > 0 && vr.inconclusive_count === 0) return false
  const openQuestions =
    vr.remaining_uncertainties.length + vr.inconclusive_count + vr.resolution_limitations.length
  return openQuestions >= MARGINAL_VERIFICATION_RULES.min_unresolved_questions
}

function deriveClosureRecommendation(input: ResponseOrchestrationInput): ClosureRecommendation {
  const vr = input.verificationResolution
  const inactiveHours = hoursSince(input.lifecycle.inactive_since ?? input.incident.last_observed_at, input.evaluated_at)

  if (vr.has_material_conflict || vr.conflicting_count > 0) return 'closure_not_recommended'
  if (vr.inconclusive_count > 0 || vr.remaining_uncertainties.length > 0) {
    return 'continue_monitoring_before_closure'
  }
  if (input.verificationPlan && input.verificationPlan.open_needs_count > 0) {
    return 'continue_monitoring_before_closure'
  }
  if (inactiveHours !== null && inactiveHours >= REASSESSMENT_INTERVALS_HOURS.routine) {
    if (vr.satisfied_count > 0 && input.evidenceSummary.strong_count > 0) {
      return 'closure_review_recommended'
    }
  }
  return 'closure_not_recommended'
}

function buildRecommendedActions(input: ResponseOrchestrationInput, level: ResponseLevel): RecommendedAction[] {
  const vr = input.verificationResolution
  const actions: RecommendedAction[] = []

  const push = (
    action_type: RecommendedAction['action_type'],
    rationale_code: string,
    execution_mode: RecommendedAction['execution_mode'] = 'manual',
    priority = 50,
  ) => {
    const authority = getAuthorityForAction(action_type)
    actions.push({
      action_type,
      rationale_code,
      execution_mode: authority?.auto_execute_allowed ? 'auto_draft' : execution_mode,
      requires_approval: authority?.approval_required ?? true,
      priority,
    })
  }

  if (vr.non_vegetation_heat_indicated) {
    push('recommend_event_reclassification', 'non_vegetation_heat_source', 'manual', 90)
    push('continue_monitoring', 'preserve_audit_trail', 'auto_draft', 20)
    return actions
  }

  if (vr.has_material_conflict || vr.conflicting_count > 0) {
    push('request_specialist_review', 'material_conflict', 'manual', 95)
    push('maintain_incident_open', 'conflict_blocks_closure', 'auto_draft', 80)
    return actions
  }

  if (vr.mission_completed_without_evidence) {
    push('continue_monitoring', 'mission_without_evidence_not_negative_proof', 'auto_draft', 70)
    if (shouldRecommendAdditionalMission(input)) {
      push('request_additional_mission', 'unresolved_material_question', 'manual', 60)
    }
    return actions
  }

  switch (level) {
    case 'no_response_required':
      push('continue_monitoring', 'no_material_response_needed', 'auto_draft', 10)
      break
    case 'continue_monitoring':
      push('continue_monitoring', 'monitoring_appropriate', 'auto_draft', 30)
      push('schedule_reassessment', 'scheduled_review', 'auto_draft', 25)
      break
    case 'request_additional_verification':
      if (shouldRecommendAdditionalMission(input)) {
        push('request_additional_mission', 'marginal_verification_value', 'manual', 75)
      } else {
        push('continue_monitoring', 'verification_low_marginal_value', 'auto_draft', 40)
      }
      break
    case 'prepare_internal_response':
      push('prepare_internal_brief', 'internal_brief_recommended', 'auto_draft', 60)
      push('maintain_incident_open', 'incident_remains_open', 'auto_draft', 50)
      break
    case 'operational_follow_up':
      push('prepare_internal_brief', 'operational_follow_up', 'auto_draft', 70)
      push('maintain_incident_open', 'recent_activity_follow_up', 'auto_draft', 65)
      push('schedule_reassessment', 'operational_reassessment', 'auto_draft', 55)
      break
    case 'coordinate_with_responsible_party':
      push('coordinate_external_review', 'responsible_party_coordination', 'manual', 85)
      push('prepare_internal_brief', 'coordination_brief', 'auto_draft', 60)
      break
    case 'escalate_for_authorized_review':
      push('request_specialist_review', 'authorized_review_required', 'manual', 90)
      push('prepare_internal_brief', 'escalation_brief', 'auto_draft', 70)
      break
    default:
      push('continue_monitoring', 'default_monitoring', 'auto_draft', 20)
  }

  const closure = deriveClosureRecommendation(input)
  if (closure === 'closure_review_recommended') {
    push('recommend_incident_closure', 'closure_review_criteria_met', 'manual', 40)
  }

  return actions.sort((a, b) => b.priority - a.priority)
}

function buildProhibitedActions(input: ResponseOrchestrationInput): ProhibitedAction[] {
  const prohibited: ProhibitedAction[] = []
  const vr = input.verificationResolution

  if (vr.has_material_conflict || vr.conflicting_count > 0) {
    prohibited.push(
      { action_type: 'recommend_incident_closure', reason_code: 'material_conflict' },
      { action_type: 'recommend_observation_invalidation', reason_code: 'material_conflict' },
      { action_type: 'close_as_non_actionable', reason_code: 'material_conflict' },
    )
  }

  if (vr.mission_completed_without_evidence) {
    prohibited.push(
      { action_type: 'close_as_non_actionable', reason_code: 'absence_of_evidence_not_proof' },
    )
  }

  if (vr.non_vegetation_heat_indicated) {
    prohibited.push(
      { action_type: 'notify_internal_operations', reason_code: 'non_alarmist_policy' },
    )
  }

  return prohibited
}

function buildBlockingUncertainties(input: ResponseOrchestrationInput): BlockingUncertainty[] {
  const items = [
    ...input.verificationResolution.remaining_uncertainties,
    ...input.verificationResolution.resolution_limitations,
  ]
  return items.map((u, i) => ({
    code: `uncertainty_${i + 1}`,
    description: u,
    blocks_actions: ['recommend_incident_closure', 'close_as_non_actionable'] as ResponseActionType[],
  }))
}

function deriveResponseLevel(input: ResponseOrchestrationInput): {
  level: ResponseLevel
  rationaleCodes: string[]
  rules: string[]
} {
  const vr = input.verificationResolution
  const rules: string[] = []
  const rationaleCodes: string[] = []

  if (vr.non_vegetation_heat_indicated) {
    rules.push('fire_non_vegetation_heat')
    rationaleCodes.push('non_vegetation_heat_source')
    return { level: 'continue_monitoring', rationaleCodes, rules }
  }

  if (vr.has_material_conflict || vr.conflicting_count > 0) {
    rules.push('fire_conflicting_evidence')
    rationaleCodes.push('material_conflict')
    return { level: 'escalate_for_authorized_review', rationaleCodes, rules }
  }

  if (vr.mission_completed_without_evidence) {
    rules.push('fire_mission_without_evidence')
    rationaleCodes.push('mission_without_evidence')
    return {
      level: shouldRecommendAdditionalMission(input)
        ? 'request_additional_verification'
        : 'continue_monitoring',
      rationaleCodes,
      rules,
    }
  }

  if (vr.inconclusive_count > 0 || input.evidenceSummary.weak_count > 0) {
    rules.push('fire_inconclusive_evidence')
    rationaleCodes.push('inconclusive_or_weak')
    return { level: 'continue_monitoring', rationaleCodes, rules }
  }

  if (vr.satisfied_count > 0 && vr.recent_vegetation_activity_indicated) {
    rules.push('fire_recent_vegetation_activity')
    rationaleCodes.push('recent_thermal_activity_in_vegetation')
    return { level: 'operational_follow_up', rationaleCodes, rules }
  }

  if (vr.satisfied_count > 0 || vr.need_resolutions.some((n) => n.status === 'partially_satisfied')) {
    rules.push('fire_partial_or_satisfied')
    rationaleCodes.push('verification_materially_addressed')
    return { level: 'prepare_internal_response', rationaleCodes, rules }
  }

  rules.push('fire_default_monitoring')
  rationaleCodes.push('default_monitoring')
  return { level: 'continue_monitoring', rationaleCodes, rules }
}

function deriveAuthority(level: ResponseLevel): AuthorityRequirement {
  switch (level) {
    case 'escalate_for_authorized_review':
      return {
        level: 'authorized_reviewer',
        permission: 'responses.approve',
        rationale_code: 'escalation_required',
      }
    case 'coordinate_with_responsible_party':
      return {
        level: 'supervisor',
        permission: 'responses.approve',
        rationale_code: 'external_coordination',
      }
    case 'operational_follow_up':
    case 'prepare_internal_response':
      return {
        level: 'coordinator',
        permission: 'responses.decide',
        rationale_code: 'internal_response',
      }
    default:
      return {
        level: 'automatic',
        permission: 'responses.view',
        rationale_code: 'low_risk_monitoring',
      }
  }
}

export function evaluateFireResponseOrchestration(
  input: ResponseOrchestrationInput,
): ResponseOrchestrationOutput {
  const gate = evaluateReevaluationGate(input)

  const inputSignature = hashResponseContext({
    organizationId: input.organizationId,
    incidentId: input.incident.incident_id,
    incidentVersion: input.incident.incident_version,
    resolution: input.verificationResolution.version_signature,
    reevaluation: input.reevaluationState.snapshot_versions,
    model: '1.0.0',
  })

  if (gate.status !== 'ready_for_assessment') {
    const outputSignature = hashResponseContext({
      inputSignature,
      gate: gate.status,
      reasons: gate.reasons,
    })
    return {
      recommendedResponseLevel: 'continue_monitoring',
      urgency: 'routine',
      rationaleCodes: gate.reasons.map((r) => r.replace(/\s+/g, '_').toLowerCase()),
      blockingUncertainties: [],
      recommendedActions: [],
      prohibitedActions: [],
      requiredAuthority: {
        level: 'automatic',
        permission: 'responses.view',
        rationale_code: 'gate_blocked',
      },
      closureRecommendation: 'closure_not_recommended',
      assessmentStatus: gate.status,
      inputSignature,
      outputSignature,
      decisionRules: ['reevaluation_gate'],
    }
  }

  const { level, rationaleCodes, rules } = deriveResponseLevel(input)
  const urgency = deriveUrgency(input, level)
  const recommendedActions = buildRecommendedActions(input, level)
  const prohibitedActions = buildProhibitedActions(input)
  const blockingUncertainties = buildBlockingUncertainties(input)
  const closureRecommendation = deriveClosureRecommendation(input)

  const reassessmentHours =
    urgency === 'urgent_authorized_review'
      ? REASSESSMENT_INTERVALS_HOURS.conflict
      : urgency === 'watch'
        ? REASSESSMENT_INTERVALS_HOURS.limited_evidence
        : REASSESSMENT_INTERVALS_HOURS.routine

  const outputSignature = hashResponseContext({
    inputSignature,
    level,
    urgency,
    rationaleCodes,
    actionTypes: recommendedActions.map((a) => a.action_type),
    prohibited: prohibitedActions.map((p) => p.action_type),
    closureRecommendation,
  })

  return {
    recommendedResponseLevel: level,
    urgency,
    rationaleCodes,
    blockingUncertainties,
    recommendedActions,
    prohibitedActions,
    requiredAuthority: deriveAuthority(level),
    closureRecommendation,
    reassessmentAt: new Date(Date.parse(input.evaluated_at) + reassessmentHours * 3_600_000).toISOString(),
    assessmentStatus: 'recommended',
    inputSignature,
    outputSignature,
    decisionRules: rules,
  }
}
