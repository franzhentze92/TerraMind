import { evaluateResponseOrchestration } from '@/modules/response-orchestration/engine/generic-response-orchestration.engine'
import { createDecisionDraftFromAssessment } from '@/modules/response-orchestration/engine/decision-workflow.engine'
import { materializeLowRiskActionDrafts } from '@/modules/response-orchestration/engine/response-action.executor'
import { buildNotificationDirectiveDrafts } from '@/modules/response-orchestration/engine/notification-directive.engine'
import type { ResponseOrchestrationInput } from '@/modules/response-orchestration/response-orchestration.types'
import {
  buildResponseAssessmentIdempotencyKey,
  findAssessmentByIdempotency,
  insertResponseAssessment,
  insertDecisionRecord,
  insertResponseActions,
  insertNotificationDirectives,
  recordResponseOrchestrationEvent,
} from '@/pipeline/stores/response-orchestration.store.js'
import { buildNotificationDirectiveDrafts } from '@/modules/response-orchestration/engine/notification-directive.engine'

export async function runResponseAssessment(input: ResponseOrchestrationInput) {
  const output = evaluateResponseOrchestration(input)
  const idempotencyKey = buildResponseAssessmentIdempotencyKey(input)

  const existing = await findAssessmentByIdempotency(input.organizationId, idempotencyKey)
  if (existing) {
    return {
      idempotent_replay: true,
      assessment: existing,
      output,
      decision_draft: null,
      action_drafts: [],
      notification_directives: [],
    }
  }

  if (output.assessmentStatus !== 'recommended') {
    await recordResponseOrchestrationEvent({
      organizationId: input.organizationId,
      incidentId: input.incident.incident_id,
      eventType: 'assessment_gate_blocked',
      payload: { status: output.assessmentStatus, output_signature: output.outputSignature },
    })
    return {
      idempotent_replay: false,
      assessment: null,
      output,
      decision_draft: null,
      action_drafts: [],
      notification_directives: [],
    }
  }

  const assessment = await insertResponseAssessment({
    organizationId: input.organizationId,
    incidentId: input.incident.incident_id,
    incidentVersion: input.incident.incident_version,
    verificationResolutionId: input.verificationResolution.resolution_id,
    orchestrationInput: input,
    output,
    idempotencyKey,
  })

  const decisionDraft = createDecisionDraftFromAssessment({
    assessment_id: String(assessment.id),
    incident_id: input.incident.incident_id,
    organization_id: input.organizationId,
    assessment: output,
  })

  const actionDrafts = materializeLowRiskActionDrafts({
    recommendedActions: output.recommendedActions,
    prohibitedActionTypes: output.prohibitedActions.map((p) => p.action_type),
    decision_status: decisionDraft.decision_status,
  })

  const notificationDirectives = buildNotificationDirectiveDrafts(output)

  await recordResponseOrchestrationEvent({
    organizationId: input.organizationId,
    incidentId: input.incident.incident_id,
    assessmentId: String(assessment.id),
    eventType: 'assessment_created',
    payload: {
      response_level: output.recommendedResponseLevel,
      urgency: output.urgency,
      output_signature: output.outputSignature,
    },
  })

  return {
    idempotent_replay: false,
    assessment,
    output,
    decision_draft: decisionDraft,
    action_drafts: actionDrafts,
    notification_directives: notificationDirectives,
  }
}

export async function runResponseAssessmentWithPersistence(input: ResponseOrchestrationInput) {
  const result = await runResponseAssessment(input)
  if (result.idempotent_replay || !result.assessment || !result.decision_draft) return result

  const existingDecision = await import('@/pipeline/stores/response-orchestration.store.js').then((s) =>
    s.getActiveDecisionForIncident(input.incident.incident_id, input.organizationId),
  )
  if (existingDecision) {
    return { ...result, decision_draft: null, action_drafts: [], notification_directives: [] }
  }

  const decisionRow = await insertDecisionRecord({
    organizationId: input.organizationId,
    incidentId: input.incident.incident_id,
    assessmentId: String(result.assessment.id),
    draft: result.decision_draft,
  })

  const actionRows = await insertResponseActions({
    organizationId: input.organizationId,
    incidentId: input.incident.incident_id,
    decisionId: String(decisionRow.id),
    drafts: result.action_drafts,
  })

  const notificationRows = await insertNotificationDirectives({
    organizationId: input.organizationId,
    incidentId: input.incident.incident_id,
    decisionId: String(decisionRow.id),
    directives: result.notification_directives.map((d) => ({
      audience_type: d.audience_type,
      channel_type: d.channel_type,
      urgency: d.urgency,
      message_template_id: d.message_template_id,
      approval_required: d.approval_required,
      draft_payload: d.draft_payload,
    })),
  })

  await recordResponseOrchestrationEvent({
    organizationId: input.organizationId,
    incidentId: input.incident.incident_id,
    assessmentId: String(result.assessment.id),
    decisionId: String(decisionRow.id),
    eventType: 'decision_draft_created',
    payload: { decision_status: result.decision_draft.decision_status },
  })

  return {
    ...result,
    decision_row: decisionRow,
    action_rows: actionRows,
    notification_rows: notificationRows,
  }
}
