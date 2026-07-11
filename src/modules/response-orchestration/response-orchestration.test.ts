import { describe, expect, it } from 'vitest'

import {
  approveDecision,
  createDecisionDraftFromAssessment,
  rejectDecision,
  applyHumanDecisionModification,
} from '@/modules/response-orchestration/engine/decision-workflow.engine'
import { evaluateResponseOrchestration } from '@/modules/response-orchestration/engine/generic-response-orchestration.engine'
import {
  assertActionAutoExecuteAllowed,
  materializeLowRiskActionDrafts,
} from '@/modules/response-orchestration/engine/response-action.executor'
import { buildNotificationDirectiveDrafts } from '@/modules/response-orchestration/engine/notification-directive.engine'
import { evaluateReevaluationGate } from '@/modules/response-orchestration/engine/reevaluation-completion.gate'
import { containsForbiddenResponseCopy } from '@/modules/response-orchestration/response-orchestration-copy-guard'
import { buildAssessmentIdempotencyKey } from '@/modules/response-orchestration/response-orchestration.types'
import { buildResponseInputFromE2EState } from '@/pipeline/e2e/response-orchestration.harness'
import { runFullFireVerificationPipeline } from '@/pipeline/e2e/fire-intelligence-pipeline.harness'

describe('8C.1 — response orchestration engine', () => {
  it('satisfied strong evidence produces assessment with follow-up', () => {
    const state = runFullFireVerificationPipeline('E2E-001')
    const input = buildResponseInputFromE2EState(state)
    const out = evaluateResponseOrchestration(input)
    expect(out.assessmentStatus).toBe('recommended')
    expect(['operational_follow_up', 'prepare_internal_response']).toContain(out.recommendedResponseLevel)
    expect(out.recommendedActions.length).toBeGreaterThan(0)
  })

  it('partially satisfied retains uncertainty', () => {
    const state = runFullFireVerificationPipeline('E2E-002')
    const out = evaluateResponseOrchestration(buildResponseInputFromE2EState(state))
    expect(out.blockingUncertainties.length + state.need_resolution.remaining_uncertainties.length).toBeGreaterThan(0)
  })

  it('inconclusive blocks strong actions', () => {
    const state = runFullFireVerificationPipeline('E2E-003')
    const out = evaluateResponseOrchestration(buildResponseInputFromE2EState(state))
    expect(out.prohibitedActions.some((p) => p.action_type === 'close_as_non_actionable')).toBe(false)
    expect(out.recommendedActions.every((a) => a.action_type !== 'close_as_non_actionable')).toBe(true)
  })

  it('conflicting evidence blocks closure and escalates', () => {
    const state = runFullFireVerificationPipeline('E2E-004')
    const out = evaluateResponseOrchestration(buildResponseInputFromE2EState(state))
    expect(out.recommendedResponseLevel).toBe('escalate_for_authorized_review')
    expect(out.prohibitedActions.some((p) => p.action_type === 'recommend_incident_closure')).toBe(true)
    expect(out.closureRecommendation).toBe('closure_not_recommended')
  })

  it('non-vegetation source recommends reclassification not alarm', () => {
    const state = runFullFireVerificationPipeline('E2E-005')
    const out = evaluateResponseOrchestration(buildResponseInputFromE2EState(state))
    expect(out.recommendedActions.some((a) => a.action_type === 'recommend_event_reclassification')).toBe(true)
    expect(out.prohibitedActions.some((p) => p.action_type === 'notify_internal_operations')).toBe(true)
    expect(out.recommendedResponseLevel).toBe('continue_monitoring')
  })

  it('mission without evidence is not treated as negative proof', () => {
    const state = runFullFireVerificationPipeline('E2E-001', {
      evidence: { skip_evidence: true, complete_mission: false, mission_status: 'completed' },
    })
    const out = evaluateResponseOrchestration(buildResponseInputFromE2EState(state))
    expect(out.recommendedActions.some((a) => a.action_type === 'continue_monitoring')).toBe(true)
    expect(out.prohibitedActions.some((p) => p.action_type === 'close_as_non_actionable')).toBe(true)
  })

  it('same input produces same output signature', () => {
    const state = runFullFireVerificationPipeline('E2E-001')
    const input = buildResponseInputFromE2EState(state)
    const a = evaluateResponseOrchestration(input)
    const b = evaluateResponseOrchestration(input)
    expect(a.outputSignature).toBe(b.outputSignature)
  })

  it('idempotency key stable for same context', () => {
    const key = buildAssessmentIdempotencyKey({
      organizationId: 'org-1',
      incidentId: 'inc-1',
      incidentVersion: 1,
      resolutionSignature: 'res-a',
      reevaluationSignature: 'reeval-a',
      modelVersion: '1.0.0',
    })
    expect(key).toHaveLength(32)
    expect(key).toBe(
      buildAssessmentIdempotencyKey({
        organizationId: 'org-1',
        incidentId: 'inc-1',
        incidentVersion: 1,
        resolutionSignature: 'res-a',
        reevaluationSignature: 'reeval-a',
        modelVersion: '1.0.0',
      }),
    )
  })

  it('assessment does not auto-approve decision', () => {
    const state = runFullFireVerificationPipeline('E2E-001')
    const assessment = evaluateResponseOrchestration(buildResponseInputFromE2EState(state))
    const draft = createDecisionDraftFromAssessment({
      assessment_id: 'a1',
      incident_id: 'i1',
      organization_id: 'o1',
      assessment,
    })
    expect(draft.decision_status).toBe('recommended')
    expect(draft.decision_type).toBe('system_recommendation')
  })

  it('modified decision preserves original recommendation', () => {
    const state = runFullFireVerificationPipeline('E2E-001')
    const assessment = evaluateResponseOrchestration(buildResponseInputFromE2EState(state))
    const draft = createDecisionDraftFromAssessment({
      assessment_id: 'a1',
      incident_id: 'i1',
      organization_id: 'o1',
      assessment,
    })
    const modified = applyHumanDecisionModification({
      draft,
      modified_decision: 'continue_monitoring',
      rationale: 'Coordinador ajusta seguimiento',
      actor_id: 'user-1',
    })
    expect(modified.decision_status).toBe('modified')
    expect(modified.original_recommendation.outputSignature).toBe(assessment.outputSignature)
  })

  it('approve and reject decision workflow', () => {
    const state = runFullFireVerificationPipeline('E2E-001')
    const assessment = evaluateResponseOrchestration(buildResponseInputFromE2EState(state))
    const draft = createDecisionDraftFromAssessment({
      assessment_id: 'a1',
      incident_id: 'i1',
      organization_id: 'o1',
      assessment,
    })
    expect(approveDecision(draft).decision_status).toBe('approved')
    expect(rejectDecision(draft, 'no procede').decision_status).toBe('rejected')
  })

  it('high-risk action auto execute fails outside allowlist', () => {
    expect(() => assertActionAutoExecuteAllowed('coordinate_external_review')).toThrow(/auto_execute_not_allowed/)
  })

  it('low-risk drafts only from allowlist', () => {
    const state = runFullFireVerificationPipeline('E2E-001')
    const assessment = evaluateResponseOrchestration(buildResponseInputFromE2EState(state))
    const drafts = materializeLowRiskActionDrafts({
      recommendedActions: assessment.recommendedActions,
      prohibitedActionTypes: assessment.prohibitedActions.map((p) => p.action_type),
      decision_status: 'recommended',
    })
    expect(drafts.every((d) => d.execution_mode !== 'auto_execute' || d.status === 'executing')).toBe(true)
  })

  it('inconsistent snapshot blocks assessment', () => {
    const state = runFullFireVerificationPipeline('E2E-001')
    const input = buildResponseInputFromE2EState(state, {
      reevaluationState: {
        ...buildResponseInputFromE2EState(state).reevaluationState,
        pending_effect_types: ['finding_reevaluation_requested'],
      },
    })
    const gate = evaluateReevaluationGate(input)
    expect(gate.status).toBe('waiting_for_reevaluation')
    const out = evaluateResponseOrchestration(input)
    expect(out.assessmentStatus).toBe('waiting_for_reevaluation')
  })

  it('copy guard blocks alarmist language', () => {
    expect(containsForbiddenResponseCopy('incendio confirmado en el área')).toBe(true)
    expect(containsForbiddenResponseCopy('seguimiento operacional recomendado')).toBe(false)
  })

  it('notification directives remain drafts', () => {
    const state = runFullFireVerificationPipeline('E2E-004')
    const assessment = evaluateResponseOrchestration(buildResponseInputFromE2EState(state))
    const directives = buildNotificationDirectiveDrafts(assessment)
    expect(directives.every((d) => d.status === 'draft')).toBe(true)
    expect(directives.every((d) => d.approval_required)).toBe(true)
  })
})
