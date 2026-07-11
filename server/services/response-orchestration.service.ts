import {
  approveDecision,
  applyHumanDecisionModification,
  createDecisionDraftFromAssessment,
  rejectDecision,
} from '@/modules/response-orchestration/engine/decision-workflow.engine'
import { buildInternalResponseBriefing } from '@/modules/response-orchestration/briefing/internal-response-briefing'
import { assertSafeResponsePayload } from '@/modules/response-orchestration/response-orchestration-copy-guard'
import type { ResponseOrchestrationOutput } from '@/modules/response-orchestration/response-orchestration.types'
import { resolveResponseBadge } from '@/modules/response-orchestration/utils/response-status-labels'
import { runResponseAssessmentWithPersistence } from '@/pipeline/engines/response-orchestration/response-orchestration.runner.js'
import { buildResponseOrchestrationInputForIncident } from '@/pipeline/engines/response-orchestration/response-orchestration-input.builder.js'
import { getIncidentById } from '@/pipeline/stores/incidents.store.js'
import {
  getActiveAssessmentForIncident,
  getActiveDecisionForIncident,
  getDecisionById,
  insertDecisionRecord,
  insertResponseActions,
  listActionsForDecision,
  listAssessmentsForOrganization,
  listNotificationDirectivesForDecision,
  listResponseOrchestrationHistory,
  recordResponseOrchestrationEvent,
  updateDecisionRecord,
  updateResponseAction,
} from '@/pipeline/stores/response-orchestration.store.js'

function mapAssessmentToOutput(row: Record<string, unknown>): ResponseOrchestrationOutput {
  return {
    recommendedResponseLevel: row.recommended_response_level as ResponseOrchestrationOutput['recommendedResponseLevel'],
    urgency: row.urgency as ResponseOrchestrationOutput['urgency'],
    rationaleCodes: (row.rationale_codes as string[]) ?? [],
    blockingUncertainties: (row.blocking_uncertainties as ResponseOrchestrationOutput['blockingUncertainties']) ?? [],
    recommendedActions: (row.recommended_actions as ResponseOrchestrationOutput['recommendedActions']) ?? [],
    prohibitedActions: (row.prohibited_actions as ResponseOrchestrationOutput['prohibitedActions']) ?? [],
    requiredAuthority: (row.required_authority as ResponseOrchestrationOutput['requiredAuthority']) ?? {
      level: 'automatic',
      permission: 'responses.view',
      rationale_code: 'default',
    },
    closureRecommendation: row.closure_recommendation as ResponseOrchestrationOutput['closureRecommendation'],
    reassessmentAt: (row.reassessment_at as string) ?? undefined,
    assessmentStatus: row.status as ResponseOrchestrationOutput['assessmentStatus'],
    inputSignature: String(row.input_signature),
    outputSignature: String(row.output_signature),
    decisionRules: [],
  }
}

export async function listResponses(organizationId: string, filter?: string) {
  const assessments = await listAssessmentsForOrganization(organizationId)
  const items = []

  for (const assessment of assessments) {
    const incidentId = String(assessment.incident_id)
    const decision = await getActiveDecisionForIncident(incidentId, organizationId)
    const actions = decision ? await listActionsForDecision(String(decision.id)) : []
    const badge = resolveResponseBadge({
      recommended_level: String(assessment.recommended_response_level),
      decision_status: decision ? String(decision.decision_status) : 'recommended',
      assessment_status: String(assessment.status),
      has_executing_action: actions.some((a) => a.status === 'executing'),
    })

    const row = {
      incident_id: incidentId,
      assessment_id: String(assessment.id),
      decision_id: decision ? String(decision.id) : null,
      recommended_level: assessment.recommended_response_level,
      urgency: assessment.urgency,
      assessment_status: assessment.status,
      decision_status: decision?.decision_status ?? 'recommended',
      primary_action: actions[0]?.action_type ?? null,
      owner_id: actions[0]?.owner_id ?? null,
      next_milestone: assessment.reassessment_at ?? null,
      badge,
      updated_at: assessment.updated_at,
    }

    if (filter && filter !== badge && filter !== row.decision_status) continue
    items.push(row)
  }

  return { items, generated_at: new Date().toISOString() }
}

export async function getResponseDetail(incidentId: string, organizationId: string) {
  const incident = await getIncidentById(incidentId)
  if (!incident) return null
  if (!incident.organization_id) {
    return {
      incident_id: incidentId,
      ownership_unresolved: true,
      incident,
      generated_at: new Date().toISOString(),
    }
  }

  const assessment = await getActiveAssessmentForIncident(incidentId, organizationId)
  const decision = await getActiveDecisionForIncident(incidentId, organizationId)
  const actions = decision ? await listActionsForDecision(String(decision.id)) : []
  const notifications = decision ? await listNotificationDirectivesForDecision(String(decision.id)) : []

  const badge = resolveResponseBadge({
    recommended_level: assessment ? String(assessment.recommended_response_level) : null,
    decision_status: decision ? String(decision.decision_status) : null,
    assessment_status: assessment ? String(assessment.status) : null,
    has_executing_action: actions.some((a) => a.status === 'executing'),
  })

  return {
    incident_id: incidentId,
    incident,
    assessment,
    recommendation: assessment
      ? {
          ...mapAssessmentToOutput(assessment as Record<string, unknown>),
          epistemic: 'recommended',
        }
      : null,
    decision: decision
      ? {
          ...decision,
          epistemic: 'human_decision',
          original_recommendation: decision.original_recommendation,
        }
      : null,
    actions,
    notification_directives: notifications.filter((n) => n.status === 'draft'),
    badge,
    generated_at: new Date().toISOString(),
  }
}

export async function assessIncidentResponse(
  incidentId: string,
  organizationId: string,
  input: { idempotency_key: string; actor_id?: string },
) {
  const built = await buildResponseOrchestrationInputForIncident(incidentId, organizationId)
  if ('ownership_unresolved' in built) {
    return { ok: false, reason: 'ownership_unresolved' }
  }

  const result = await runResponseAssessmentWithPersistence(built)
  assertSafeResponsePayload(result.output)

  await recordResponseOrchestrationEvent({
    organizationId,
    incidentId,
    assessmentId: result.assessment ? String(result.assessment.id) : null,
    eventType: result.idempotent_replay ? 'assessment_idempotent_replay' : 'assessment_requested',
    actorType: 'user',
    actorId: input.actor_id ?? null,
    payload: { idempotency_key: input.idempotency_key, status: result.output.assessmentStatus },
  })

  return {
    ok: true,
    idempotent_replay: result.idempotent_replay,
    assessment: result.assessment,
    output: result.output,
    persisted: Boolean(result.assessment && !result.idempotent_replay),
  }
}

export async function createHumanDecision(
  incidentId: string,
  organizationId: string,
  input: { actor_id: string; rationale?: string },
) {
  const assessment = await getActiveAssessmentForIncident(incidentId, organizationId)
  if (!assessment) throw new Error('assessment_not_found')

  const existing = await getActiveDecisionForIncident(incidentId, organizationId)
  if (existing && existing.decision_status !== 'recommended') {
    return { decision: existing, created: false }
  }

  const output = mapAssessmentToOutput(assessment as Record<string, unknown>)
  const draft = createDecisionDraftFromAssessment({
    assessment_id: String(assessment.id),
    incident_id: incidentId,
    organization_id: organizationId,
    assessment: output,
    decided_by: input.actor_id,
  })

  if (input.rationale) draft.rationale = input.rationale
  draft.decision_status = 'pending_review'

  const row = await insertDecisionRecord({
    organizationId,
    incidentId,
    assessmentId: String(assessment.id),
    draft,
    decidedBy: input.actor_id,
    supersedesDecisionId: existing ? String(existing.id) : null,
  })

  if (existing) {
    await updateDecisionRecord(String(existing.id), { decision_status: 'superseded' })
  }

  await recordResponseOrchestrationEvent({
    organizationId,
    incidentId,
    assessmentId: String(assessment.id),
    decisionId: String(row.id),
    eventType: 'decision_created',
    actorType: 'user',
    actorId: input.actor_id,
  })

  return { decision: row, created: true }
}

export async function modifyDecision(
  decisionId: string,
  input: { modified_decision: string; rationale: string; actor_id: string; updated_at?: string },
) {
  assertSafeResponsePayload({ rationale: input.rationale, decision: input.modified_decision })

  const decision = await getDecisionById(decisionId)
  if (!decision) throw new Error('decision_not_found')
  if (decision.decision_status === 'superseded') throw new Error('decision_superseded')
  if (!input.rationale.trim()) throw new Error('rationale_required')

  const draft = applyHumanDecisionModification({
    draft: {
      decision_type: 'human_decision',
      decision: String(decision.decision),
      decision_status: decision.decision_status as never,
      original_recommendation: decision.original_recommendation as ResponseOrchestrationOutput,
      rationale: String(decision.rationale),
      limitations: (decision.limitations as string[]) ?? [],
    },
    modified_decision: input.modified_decision,
    rationale: input.rationale,
    actor_id: input.actor_id,
  })

  const updated = await updateDecisionRecord(
    decisionId,
    {
      decision: draft.decision,
      decision_type: draft.decision_type,
      decision_status: draft.decision_status,
      rationale: draft.rationale,
      limitations: draft.limitations,
      decided_by: input.actor_id,
      decided_at: new Date().toISOString(),
    },
    input.updated_at,
  )

  await recordResponseOrchestrationEvent({
    organizationId: String(decision.organization_id),
    incidentId: String(decision.incident_id),
    decisionId,
    eventType: 'decision_modified',
    actorType: 'user',
    actorId: input.actor_id,
    payload: { modified_decision: input.modified_decision },
  })

  return updated
}

export async function approveResponseDecision(decisionId: string, actorId: string) {
  const decision = await getDecisionById(decisionId)
  if (!decision) throw new Error('decision_not_found')
  if (decision.decision_status === 'superseded') throw new Error('decision_superseded')
  if (decision.decision_status === 'approved') throw new Error('decision_already_approved')

  const draft = approveDecision({
    decision_type: decision.decision_type as 'system_recommendation' | 'human_decision',
    decision: String(decision.decision),
    decision_status: decision.decision_status as never,
    original_recommendation: decision.original_recommendation as ResponseOrchestrationOutput,
    rationale: String(decision.rationale),
    limitations: (decision.limitations as string[]) ?? [],
  })

  const updated = await updateDecisionRecord(decisionId, {
    decision_status: draft.decision_status,
    decided_by: actorId,
    decided_at: new Date().toISOString(),
  })

  await recordResponseOrchestrationEvent({
    organizationId: String(decision.organization_id),
    incidentId: String(decision.incident_id),
    decisionId,
    eventType: 'decision_approved',
    actorType: 'user',
    actorId,
  })

  return updated
}

export async function rejectResponseDecision(decisionId: string, actorId: string, rationale: string) {
  assertSafeResponsePayload({ rationale })
  if (!rationale.trim()) throw new Error('rationale_required')

  const decision = await getDecisionById(decisionId)
  if (!decision) throw new Error('decision_not_found')
  if (decision.decision_status === 'superseded') throw new Error('decision_superseded')

  const draft = rejectDecision(
    {
      decision_type: decision.decision_type as 'system_recommendation' | 'human_decision',
      decision: String(decision.decision),
      decision_status: decision.decision_status as never,
      original_recommendation: decision.original_recommendation as ResponseOrchestrationOutput,
      rationale: String(decision.rationale),
      limitations: (decision.limitations as string[]) ?? [],
    },
    rationale,
  )

  const updated = await updateDecisionRecord(decisionId, {
    decision_status: draft.decision_status,
    rationale: draft.rationale,
    limitations: draft.limitations,
    decided_by: actorId,
    decided_at: new Date().toISOString(),
  })

  await recordResponseOrchestrationEvent({
    organizationId: String(decision.organization_id),
    incidentId: String(decision.incident_id),
    decisionId,
    eventType: 'decision_rejected',
    actorType: 'user',
    actorId,
    payload: { assessment_preserved: true },
  })

  return updated
}

export async function createDecisionAction(
  decisionId: string,
  input: {
    action_type: string
    owner_id?: string | null
    priority?: number
    due_at?: string | null
    actor_id: string
  },
) {
  const decision = await getDecisionById(decisionId)
  if (!decision) throw new Error('decision_not_found')

  const rows = await insertResponseActions({
    organizationId: String(decision.organization_id),
    incidentId: String(decision.incident_id),
    decisionId,
    drafts: [
      {
        action_type: input.action_type as never,
        status: 'draft',
        execution_mode: 'manual',
        requires_approval: true,
        owner_type: input.owner_id ? 'user' : 'system',
        owner_id: input.owner_id ?? null,
        priority: input.priority ?? 50,
        rationale_code: 'human_selected',
      },
    ],
  })

  await recordResponseOrchestrationEvent({
    organizationId: String(decision.organization_id),
    incidentId: String(decision.incident_id),
    decisionId,
    eventType: 'action_created',
    actorType: 'user',
    actorId: input.actor_id,
  })

  return rows[0]
}

export async function patchResponseAction(
  actionId: string,
  patch: Record<string, unknown>,
  actorId: string,
) {
  assertSafeResponsePayload(patch)
  const updated = await updateResponseAction(actionId, patch)
  if (!updated) throw new Error('action_not_found')

  await recordResponseOrchestrationEvent({
    organizationId: String(updated.organization_id),
    incidentId: String(updated.incident_id),
    decisionId: String(updated.decision_id),
    eventType: 'action_updated',
    actorType: 'user',
    actorId,
    payload: patch,
  })

  return updated
}

export async function getResponseBriefing(incidentId: string, organizationId: string) {
  const detail = await getResponseDetail(incidentId, organizationId)
  if (!detail || detail.ownership_unresolved) return detail

  const assessment = detail.assessment as Record<string, unknown> | null
  if (!assessment) return { ...detail, briefing: null }

  const snapshot = assessment.input_snapshot as import('@/modules/response-orchestration/response-orchestration.types').ResponseOrchestrationInput
  const output = mapAssessmentToOutput(assessment)
  const briefing = buildInternalResponseBriefing({
    orchestrationInput: snapshot,
    assessment: output,
    decision: detail.decision as Record<string, unknown> | undefined,
    actions: detail.actions as Array<Record<string, unknown>>,
  })
  assertSafeResponsePayload(briefing)
  return { ...detail, briefing }
}

export async function getClosureAssessment(incidentId: string, organizationId: string) {
  const assessment = await getActiveAssessmentForIncident(incidentId, organizationId)
  if (!assessment) return null
  return {
    incident_id: incidentId,
    closure_recommendation: assessment.closure_recommendation,
    blocking_uncertainties: assessment.blocking_uncertainties,
    reassessment_at: assessment.reassessment_at,
    generated_at: new Date().toISOString(),
  }
}

export async function getResponseHistory(incidentId: string, organizationId: string) {
  const items = await listResponseOrchestrationHistory(incidentId, organizationId)
  return { items, generated_at: new Date().toISOString() }
}
