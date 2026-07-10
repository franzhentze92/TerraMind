import { describe, expect, it } from 'vitest'

import { containsForbiddenFindingCopy } from '@/modules/findings/findings-copy-guard'
import { containsForbiddenPriorityCopy } from '@/modules/priorities/priorities-copy-guard'
import { containsForbiddenResolutionCopy } from '@/modules/verification/resolution/verification-resolution-copy-guard'
import {
  assertNoPipelineDuplicates,
  runFullFireVerificationPipeline,
} from './fire-intelligence-pipeline.harness'
import {
  FIRE_E2E_EXPECTED_FINDING_CODES,
  FIRE_E2E_EXPECTED_FINDING_TYPES,
} from './fixtures/fire-e2e-contexts'

describe('8B.6A — fire intelligence to verification (engine E2E)', () => {
  it('E2E-001 — strong evidence satisfies need and enqueues downstream jobs', () => {
    const state = runFullFireVerificationPipeline('E2E-001')

    expect(['active', 'persistent']).toContain(state.lifecycle.new_state)
    expect(state.lifecycle.transitioned).toBe(true)

    for (const code of FIRE_E2E_EXPECTED_FINDING_CODES) {
      expect(state.finding_codes).toContain(code)
    }
    expect(state.finding_codes).toContain('THERMAL_BIODIVERSITY_002')
    for (const type of FIRE_E2E_EXPECTED_FINDING_TYPES) {
      expect(state.findings.some((f) => f.finding_type === type)).toBe(true)
    }
    expect(state.findings.every((f) => !containsForbiddenFindingCopy(f.summary))).toBe(true)

    expect(state.priority.assessment.attention_score).toBeGreaterThanOrEqual(60)
    expect(state.priority.assessment.verification_score).toBeGreaterThanOrEqual(20)
    expect(state.priority.assessment.action_score).toBeLessThanOrEqual(55)
    expect(containsForbiddenPriorityCopy(state.priority.assessment.priority_reasons.join(' '))).toBe(
      false,
    )

    expect(state.incident.correlation_decision).toBe('create_new_incident')

    expect(state.verification_plan.status).toBe('ready')
    expect(state.verification_plan.mission_candidate_pending).toBe(true)
    expect(state.verification_plan.needs.length).toBeGreaterThan(0)
    expect(
      state.verification_plan.needs.some(
        (n) =>
          n.need_type === 'obtain_visual_ground_evidence' ||
          n.need_type === 'confirm_recent_activity' ||
          n.need_type === 'differentiate_possible_non_fire_heat_source',
      ),
    ).toBe(true)

    expect(state.mission.decision).toBe('create_mission')
    expect(['field_visual_inspection', 'remote_analytical_review']).toContain(state.mission.mission_type)
    expect(state.mission.status).toBe('ready')
    expect(state.mission.tasks.length).toBeGreaterThanOrEqual(3)
    expect(state.mission.evidence_requirements.length).toBeGreaterThan(0)

    expect(state.assignment_history).toContain('assign')
    expect(state.assignment_history).toContain('start')
    expect(state.mission_status).toBe('completed')

    expect(state.validated_evidence.length).toBeGreaterThanOrEqual(1)
    expect(state.validated_evidence.every((e) => ['accepted', 'accepted_with_limitations'].includes(e.validation_status))).toBe(
      true,
    )
    expect(state.need_resolution.resolution_status).toBe('satisfied')
    expect(state.plan_resolution_status).toBe('satisfied')

    expect(state.downstream_effects).toContain('finding_reevaluation_requested')
    expect(state.downstream_effects).toContain('priority_reevaluation_requested')
    expect(state.downstream_effects).toContain('lifecycle_reevaluation_requested')
    expect(state.downstream_effects).toContain('incident_reevaluation_requested')
    expect(new Set(state.downstream_effects).size).toBe(state.downstream_effects.length)

    const copyTexts = [
      ...state.need_resolution.resolution_reasons,
      ...state.need_resolution.recommended_follow_up,
      ...state.need_resolution.remaining_uncertainties,
    ]
    expect(copyTexts.every((t) => !containsForbiddenResolutionCopy(t))).toBe(true)
  })

  it('E2E-001 — mission completed alone does not satisfy need before resolution evidence', () => {
    const inProgress = runFullFireVerificationPipeline('E2E-001', {
      evidence: { complete_mission: false, mission_status: 'completed', skip_evidence: true },
    })
    expect(inProgress.mission_status).toBe('completed')
    expect(inProgress.validated_evidence.length).toBe(0)
    expect(inProgress.need_resolution.resolution_status).toBe('inconclusive')
  })

  it('E2E-002 — limited evidence yields partially_satisfied', () => {
    const state = runFullFireVerificationPipeline('E2E-002')
    expect(state.validated_evidence.some((e) => e.validation_status === 'accepted_with_limitations')).toBe(
      true,
    )
    expect(state.need_resolution.resolution_status).toBe('partially_satisfied')
    expect(state.need_resolution.recommended_follow_up.length).toBeGreaterThan(0)
    expect(state.plan_resolution_status).toBe('partially_satisfied')
  })

  it('E2E-003 — inconclusive mission and weak visibility stay inconclusive', () => {
    const state = runFullFireVerificationPipeline('E2E-003')
    expect(state.mission_status).toBe('inconclusive')
    expect(['inconclusive', 'insufficient_evidence', 'partially_satisfied']).toContain(
      state.need_resolution.resolution_status,
    )
    expect(
      state.need_resolution.recommended_follow_up.length +
        state.need_resolution.remaining_uncertainties.length,
    ).toBeGreaterThan(0)
  })

  it('E2E-004 — material contradiction yields conflicting_evidence', () => {
    const state = runFullFireVerificationPipeline('E2E-004')
    expect(state.need_resolution.resolution_status).toBe('conflicting_evidence')
    expect(state.plan_resolution_status).toBe('inconclusive')
  })

  it('E2E-005 — non-vegetal heat source satisfies differentiate need without direct invalidation', () => {
    const state = runFullFireVerificationPipeline('E2E-005')
    expect(state.need_resolution.resolution_status).toBe('satisfied')
    expect(state.downstream_effects).toContain('finding_reevaluation_requested')
    expect(state.downstream_effects).toContain('priority_reevaluation_requested')
    expect(
      [...state.need_resolution.resolution_reasons, ...state.need_resolution.remaining_uncertainties].some(
        (t) => t.toLowerCase().includes('descarta') || t.toLowerCase().includes('falso'),
      ),
    ).toBe(false)
  })

  it('E2E-006 — full reprocesamiento mantiene firmas y conteos sin duplicados', () => {
    const first = runFullFireVerificationPipeline('E2E-001')
    const second = runFullFireVerificationPipeline('E2E-001')
    expect(() => assertNoPipelineDuplicates(first, second)).not.toThrow()

    const shuffled = runFullFireVerificationPipeline('E2E-001', { shuffleEvidenceOrder: true })
    expect(shuffled.need_resolution.context_signature).toBe(first.need_resolution.context_signature)
    expect(shuffled.need_resolution.resolution_status).toBe(first.need_resolution.resolution_status)
  })
})
