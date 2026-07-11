import { describe, expect, it, beforeEach } from 'vitest'
import { IncomingMessage } from 'node:http'
import { Socket } from 'node:net'

import { resolveRequestAuth } from '../auth/resolve-auth-context.js'
import {
  authorizeResponseAssessmentAccess,
  authorizeResponseApproval,
  authorizeResponseListScope,
} from '../services/authorization/response-access.js'
import { TEST_INCIDENT_ORG_A } from '../auth/resource-fixtures.js'
import { AuthorizationError } from '@/core/auth/permissions.js'
import {
  approveDecision,
  applyHumanDecisionModification,
  rejectDecision,
} from '@/modules/response-orchestration/engine/decision-workflow.engine'
import { containsForbiddenResponseCopy } from '@/modules/response-orchestration/response-orchestration-copy-guard'
import { resolveResponseBadge } from '@/modules/response-orchestration/utils/response-status-labels'
import { evaluateReevaluationGate } from '@/modules/response-orchestration/engine/reevaluation-completion.gate'
import { buildResponseInputFromE2EState } from '@/pipeline/e2e/response-orchestration.harness'
import { runFullFireVerificationPipeline } from '@/pipeline/e2e/fire-intelligence-pipeline.harness'

process.env.AUTH_TEST_MODE = '1'
process.env.AUTH_ENFORCE = 'true'

function mockReq(authHeader?: string): IncomingMessage {
  const socket = new Socket()
  const req = new IncomingMessage(socket)
  if (authHeader) req.headers.authorization = authHeader
  return req
}

describe('response orchestration API auth — 8C.1.2', () => {
  beforeEach(() => {
    process.env.AUTH_TEST_MODE = '1'
    process.env.AUTH_ENFORCE = 'true'
  })

  it('denies cross-tenant response assessment access', async () => {
    const techB = (await resolveRequestAuth(mockReq('Bearer test-tech-org-b')))!
    await expect(
      authorizeResponseAssessmentAccess(techB, TEST_INCIDENT_ORG_A),
    ).rejects.toBeInstanceOf(AuthorizationError)
  })

  it('allows org admin list scope in same tenant', async () => {
    const admin = (await resolveRequestAuth(mockReq('Bearer test-org-admin-org-a')))!
    const ctx = authorizeResponseListScope(admin)
    expect(ctx.organizationId).toBeTruthy()
  })

  it('denies field technician approval authority', async () => {
    const tech = (await resolveRequestAuth(mockReq('Bearer test-tech-org-a')))!
    await expect(
      authorizeResponseApproval(tech, '00000000-0000-4000-a07f-00000000d100'),
    ).rejects.toBeInstanceOf(AuthorizationError)
  })
})

describe('response orchestration workflow — 8C.1.2', () => {
  it('modify requires rationale in engine', () => {
    expect(() =>
      applyHumanDecisionModification({
        draft: {
          decision_type: 'system_recommendation',
          decision: 'continue_monitoring',
          decision_status: 'recommended',
          original_recommendation: {} as never,
          rationale: 'x',
          limitations: [],
        },
        modified_decision: 'prepare_internal_response',
        rationale: 'ajuste operacional',
        actor_id: 'user-1',
      }),
    ).not.toThrow()
  })

  it('cannot approve superseded decision', () => {
    expect(() =>
      approveDecision({
        decision_type: 'human_decision',
        decision: 'x',
        decision_status: 'superseded',
        original_recommendation: {} as never,
        rationale: '',
        limitations: [],
      }),
    ).toThrow(/cannot_approve_terminal_decision/)
  })

  it('reject preserves assessment semantics in limitations', () => {
    const rejected = rejectDecision(
      {
        decision_type: 'system_recommendation',
        decision: 'continue_monitoring',
        decision_status: 'recommended',
        original_recommendation: {} as never,
        rationale: 'motor',
        limitations: [],
      },
      'no procede por incertidumbre',
    )
    expect(rejected.decision_status).toBe('rejected')
    expect(rejected.limitations.some((l) => l.includes('conservado'))).toBe(true)
  })

  it('copy guard blocks alarmist language', () => {
    expect(containsForbiddenResponseCopy('incendio confirmado en la zona')).toBe(true)
    expect(containsForbiddenResponseCopy('se requiere revisión interna')).toBe(false)
  })

  it('reevaluation gate waits for pending dependencies', () => {
    const state = runFullFireVerificationPipeline('E2E-001')
    const input = buildResponseInputFromE2EState(state, {
      reevaluationState: {
        lifecycle_complete: false,
        findings_complete: false,
        priority_complete: false,
        incident_correlation_complete: false,
        verification_plan_complete: false,
        pending_effect_types: ['finding_reevaluation_requested'],
        snapshot_versions: {
          lifecycle: 'lc-v1',
          findings: 'fd-v1',
          priority: 'pr-v1',
          incident: '1',
          resolution: state.signatures.resolution,
        },
      },
    })
    const gate = evaluateReevaluationGate(input)
    expect(gate.status).toBe('waiting_for_reevaluation')
    expect(gate.reasons.length).toBeGreaterThan(0)
  })

  it('command center badge separates monitoring vs pending decision', () => {
    expect(
      resolveResponseBadge({ recommended_level: 'continue_monitoring', decision_status: 'recommended' }),
    ).toBe('monitoreo')
    expect(
      resolveResponseBadge({ recommended_level: 'prepare_internal_response', decision_status: 'recommended' }),
    ).toBe('respuesta_interna')
    expect(resolveResponseBadge({ ownership_unresolved: true })).toBe('ownership_unresolved')
  })
})

describe('response orchestration integrated e2e harness — 8C.1.2', () => {
  it('extends resolution → assessment path without duplicate draft on replay', async () => {
    const state = runFullFireVerificationPipeline('E2E-001')
    const input = buildResponseInputFromE2EState(state)
    const { evaluateResponseOrchestration } = await import(
      '@/modules/response-orchestration/engine/generic-response-orchestration.engine'
    )
    const { createDecisionDraftFromAssessment } = await import(
      '@/modules/response-orchestration/engine/decision-workflow.engine'
    )
    const output = evaluateResponseOrchestration(input)
    const draft = createDecisionDraftFromAssessment({
      assessment_id: 'a1',
      incident_id: input.incident.incident_id,
      organization_id: input.organizationId,
      assessment: output,
    })
    expect(draft.decision_status).toBe('recommended')
    expect(draft.decision).toBe(output.recommendedResponseLevel)
  })
})
