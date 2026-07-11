import { describe, expect, it } from 'vitest'

import { createDecisionDraftFromAssessment } from '@/modules/response-orchestration/engine/decision-workflow.engine'
import { evaluateResponseOrchestration } from '@/modules/response-orchestration/engine/generic-response-orchestration.engine'
import { materializeLowRiskActionDrafts } from '@/modules/response-orchestration/engine/response-action.executor'
import { buildInternalResponseBriefing } from '@/modules/response-orchestration/briefing/internal-response-briefing'
import { buildNotificationDirectiveDrafts } from '@/modules/response-orchestration/engine/notification-directive.engine'
import { buildResponseInputFromE2EState } from '@/pipeline/e2e/response-orchestration.harness'
import { runFullFireVerificationPipeline } from '@/pipeline/e2e/fire-intelligence-pipeline.harness'

describe('8C.1 — response orchestration E2E extension (engine)', () => {
  const scenarios = ['E2E-001', 'E2E-002', 'E2E-003', 'E2E-004', 'E2E-005', 'E2E-006'] as const

  for (const scenario of scenarios) {
    it(`${scenario} — resolution → assessment → decision draft → low-risk actions`, () => {
      const state = runFullFireVerificationPipeline(scenario)
      const input = buildResponseInputFromE2EState(state)
      const assessment = evaluateResponseOrchestration(input)

      expect(assessment.inputSignature).toBeTruthy()
      expect(assessment.outputSignature).toBeTruthy()

      const decisionDraft = createDecisionDraftFromAssessment({
        assessment_id: `assess-${scenario}`,
        incident_id: input.incident.incident_id,
        organization_id: input.organizationId,
        assessment,
      })
      expect(decisionDraft.decision_status).toBe('recommended')

      const actions = materializeLowRiskActionDrafts({
        recommendedActions: assessment.recommendedActions,
        prohibitedActionTypes: assessment.prohibitedActions.map((p) => p.action_type),
        decision_status: decisionDraft.decision_status,
      })

      const briefing = buildInternalResponseBriefing({
        orchestrationInput: input,
        assessment,
        decision: { status: decisionDraft.decision_status },
        actions,
      })
      expect(briefing.recommendedResponse.epistemic).toBe('recommended')

      const directives = buildNotificationDirectiveDrafts(assessment)
      expect(directives.every((d) => d.status === 'draft')).toBe(true)
    })
  }

  it('E2E-006 — idempotent reprocessing keeps assessment signature', () => {
    const first = evaluateResponseOrchestration(buildResponseInputFromE2EState(runFullFireVerificationPipeline('E2E-006')))
    const second = evaluateResponseOrchestration(buildResponseInputFromE2EState(runFullFireVerificationPipeline('E2E-006')))
    expect(second.outputSignature).toBe(first.outputSignature)
  })
})
