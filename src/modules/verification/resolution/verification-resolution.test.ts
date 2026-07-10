import { describe, expect, it } from 'vitest'

import {
  derivePlanResolution,
  evaluateNeedResolution,
} from '@/modules/verification/resolution/verification-resolution.engine'
import {
  containsForbiddenResolutionCopy,
  assertSafeResolutionCopy,
} from '@/modules/verification/resolution/verification-resolution-copy-guard'
import { SYNTHETIC_RESOLUTION_FIXTURES } from '@/modules/verification/config/fire-verification-resolution.config'
import type {
  NeedResolutionSnapshot,
  ValidatedEvidenceItem,
} from '@/modules/verification/resolution/verification-resolution.types'

function baseSnapshot(overrides: Partial<NeedResolutionSnapshot> = {}): NeedResolutionSnapshot {
  const f = SYNTHETIC_RESOLUTION_FIXTURES
  return {
    need_id: f.need_visual.need_id,
    need_type: f.need_visual.need_type,
    need_question: f.need_visual.need_question,
    need_priority: f.need_visual.need_priority,
    plan_id: 'plan-1',
    plan_status: 'in_progress',
    incident_id: 'inc-1',
    incident_status: 'active',
    incident_last_observed_at: '2026-07-10T08:00:00.000Z',
    recommended_window_hours: f.need_visual.recommended_window_hours,
    validated_evidence: [],
    mission_outcomes: [],
    conflicts: [],
    previous_resolution_status: 'open',
    ...overrides,
  }
}

function asEvidence(item: ValidatedEvidenceItem): ValidatedEvidenceItem {
  return { ...item }
}

describe('verification resolution engine', () => {
  it('strong complete evidence can satisfy need', () => {
    const result = evaluateNeedResolution(
      baseSnapshot({
        validated_evidence: [asEvidence(SYNTHETIC_RESOLUTION_FIXTURES.strong_visual_evidence)],
      }),
    )
    expect(result.resolution_status).toBe('satisfied')
    expect(result.resolution_confidence).toBeGreaterThan(50)
    expect(result.evidence_bundle.validations_used).toHaveLength(1)
  })

  it('accepted evidence with limitations produces partially_satisfied', () => {
    const result = evaluateNeedResolution(
      baseSnapshot({
        validated_evidence: [asEvidence(SYNTHETIC_RESOLUTION_FIXTURES.limited_evidence)],
      }),
    )
    expect(result.resolution_status).toBe('partially_satisfied')
    expect(result.resolution_limitations.length).toBeGreaterThan(0)
  })

  it('high quality irrelevant evidence does not satisfy need', () => {
    const result = evaluateNeedResolution(
      baseSnapshot({
        validated_evidence: [asEvidence(SYNTHETIC_RESOLUTION_FIXTURES.irrelevant_evidence)],
      }),
    )
    expect(result.resolution_status).toBe('insufficient_evidence')
    expect(result.evidence_bundle.submissions_discarded.length).toBeGreaterThan(0)
  })

  it('insufficient evidence produces insufficient_evidence status', () => {
    const result = evaluateNeedResolution(baseSnapshot())
    expect(result.resolution_status).toBe('insufficient_evidence')
  })

  it('material contradictory evidence produces conflicting_evidence', () => {
    const smokeYes = {
      ...SYNTHETIC_RESOLUTION_FIXTURES.strong_visual_evidence,
      submission_id: 'sub-smoke-yes',
      observation: { visible_smoke: 'yes' },
      captured_at: '2026-07-10T10:00:00.000Z',
    }
    const smokeNo = {
      ...SYNTHETIC_RESOLUTION_FIXTURES.strong_visual_evidence,
      submission_id: 'sub-smoke-no',
      validation_id: 'val-smoke-no',
      submitted_by_id: 'user-other',
      source_device: 'phone-9',
      observation: { visible_smoke: 'no' },
      captured_at: '2026-07-10T10:30:00.000Z',
    }
    const result = evaluateNeedResolution(
      baseSnapshot({
        validated_evidence: [asEvidence(smokeYes), asEvidence(smokeNo)],
        conflicts: [
          {
            ...SYNTHETIC_RESOLUTION_FIXTURES.material_conflict,
            captured_at_a: smokeYes.captured_at,
            captured_at_b: smokeNo.captured_at,
          },
        ],
      }),
    )
    expect(result.resolution_status).toBe('conflicting_evidence')
  })

  it('explainable temporal difference does not produce material conflict', () => {
    const morning = {
      ...SYNTHETIC_RESOLUTION_FIXTURES.strong_visual_evidence,
      submission_id: 'sub-am',
      observation: { visible_smoke: 'yes' },
      captured_at: '2026-07-10T10:00:00.000Z',
    }
    const afternoon = {
      ...SYNTHETIC_RESOLUTION_FIXTURES.negative_limited,
      submission_id: 'sub-pm',
      observation: { visible_smoke: 'no' },
      captured_at: '2026-07-10T16:00:00.000Z',
    }
    const result = evaluateNeedResolution(
      baseSnapshot({
        validated_evidence: [asEvidence(morning), asEvidence(afternoon)],
        conflicts: [
          {
            submission_id_a: 'sub-am',
            submission_id_b: 'sub-pm',
            conflict_type: 'observation_contradiction',
            conflict_field: 'visible_smoke',
            description: 'Humo sí vs no',
            captured_at_a: morning.captured_at,
            captured_at_b: afternoon.captured_at,
          },
        ],
      }),
    )
    expect(result.conflict_assessment.status).toBe('explainable_difference')
    expect(result.resolution_status).not.toBe('conflicting_evidence')
  })

  it('limited negative evidence does not prove absence', () => {
    const result = evaluateNeedResolution(
      baseSnapshot({
        validated_evidence: [asEvidence(SYNTHETIC_RESOLUTION_FIXTURES.negative_limited)],
      }),
    )
    expect(['inconclusive', 'partially_satisfied']).toContain(result.resolution_status)
    expect(result.remaining_uncertainties.length + result.recommended_follow_up.length).toBeGreaterThan(0)
  })

  it('correlated evidence does not count as full independence', () => {
    const a = asEvidence(SYNTHETIC_RESOLUTION_FIXTURES.strong_visual_evidence)
    const b = {
      ...asEvidence(SYNTHETIC_RESOLUTION_FIXTURES.strong_visual_evidence),
      submission_id: 'sub-corr',
      validation_id: 'val-corr',
    }
    const result = evaluateNeedResolution(baseSnapshot({ validated_evidence: [a, b] }))
    expect(result.evidence_bundle.corroboration_level).toBe('multiple_correlated_evidence')
    expect(result.scores.corroboration_score).toBeLessThan(72)
  })

  it('independent sources increase corroboration', () => {
    const a = asEvidence(SYNTHETIC_RESOLUTION_FIXTURES.strong_visual_evidence)
    const b = asEvidence(SYNTHETIC_RESOLUTION_FIXTURES.independent_b)
    const result = evaluateNeedResolution(baseSnapshot({ validated_evidence: [a, b] }))
    expect(result.evidence_bundle.corroboration_level).toBe('multiple_independent_evidence')
    expect(result.scores.corroboration_score).toBeGreaterThanOrEqual(72)
  })

  it('completed mission without sufficient evidence does not satisfy need', () => {
    const result = evaluateNeedResolution(
      baseSnapshot({
        mission_outcomes: [SYNTHETIC_RESOLUTION_FIXTURES.mission_completed_no_evidence],
      }),
    )
    expect(result.resolution_status).toBe('inconclusive')
    expect(result.resolution_reasons.some((r) => r.includes('sin evidencia suficiente'))).toBe(true)
  })

  it('inconclusive mission keeps need open or inconclusive', () => {
    const result = evaluateNeedResolution(
      baseSnapshot({
        mission_outcomes: [
          {
            mission_id: 'mission-inc',
            status: 'inconclusive',
            mission_type: 'field_visual_inspection',
            verification_need_id: 'need-visual',
            completed_at: null,
          },
        ],
      }),
    )
    expect(['open', 'inconclusive', 'insufficient_evidence']).toContain(result.resolution_status)
  })

  it('plan satisfied only when all needs satisfied', () => {
    const summary = derivePlanResolution('plan-1', [
      { need_id: 'n1', need_type: 'obtain_visual_ground_evidence', status: 'satisfied' },
      { need_id: 'n2', need_type: 'confirm_recent_activity', status: 'satisfied' },
    ])
    expect(summary.derived_status).toBe('satisfied')
  })

  it('partially resolved plan keeps open needs', () => {
    const summary = derivePlanResolution('plan-1', [
      { need_id: 'n1', need_type: 'obtain_visual_ground_evidence', status: 'satisfied' },
      { need_id: 'n2', need_type: 'confirm_recent_activity', status: 'open' },
    ])
    expect(summary.derived_status).toBe('partially_satisfied')
    expect(summary.open_count).toBeGreaterThan(0)
  })

  it('material resolution enqueues downstream effects once', () => {
    const result = evaluateNeedResolution(
      baseSnapshot({
        need_type: 'confirm_recent_activity',
        validated_evidence: [
          asEvidence({
            ...SYNTHETIC_RESOLUTION_FIXTURES.strong_visual_evidence,
            evidence_type: 'thermal_detection_review',
            evidence_strength: 'strong',
            temporal_relevance_score: 90,
          }),
        ],
      }),
    )
    expect(result.resolution_status).toBe('satisfied')
    const unique = new Set(result.downstream_effects)
    expect(unique.size).toBe(result.downstream_effects.length)
    expect(result.downstream_effects.length).toBeGreaterThan(0)
  })

  it('same input produces same context signature regardless of order', () => {
    const a = asEvidence(SYNTHETIC_RESOLUTION_FIXTURES.strong_visual_evidence)
    const b = asEvidence(SYNTHETIC_RESOLUTION_FIXTURES.independent_b)
    const r1 = evaluateNeedResolution(baseSnapshot({ validated_evidence: [a, b] }))
    const r2 = evaluateNeedResolution(baseSnapshot({ validated_evidence: [b, a] }))
    expect(r1.context_signature).toBe(r2.context_signature)
    expect(r1.resolution_status).toBe(r2.resolution_status)
  })

  it('satisfied need with lifecycle signal requests lifecycle reevaluation', () => {
    const result = evaluateNeedResolution(
      baseSnapshot({
        need_type: 'confirm_recent_activity',
        validated_evidence: [
          asEvidence({
            ...SYNTHETIC_RESOLUTION_FIXTURES.strong_visual_evidence,
            evidence_type: 'satellite_observation',
            evidence_strength: 'very_strong',
            temporal_relevance_score: 95,
          }),
        ],
      }),
    )
    expect(result.downstream_effects).toContain('lifecycle_reevaluation_requested')
  })

  it('copy guard rejects forbidden phrases', () => {
    expect(containsForbiddenResolutionCopy('confirma incendio')).toBe(true)
    expect(containsForbiddenResolutionCopy('necesidad satisfecha')).toBe(false)
    expect(() => assertSafeResolutionCopy('extinción confirmada')).toThrow()
  })

  it('outputs do not use forbidden copy', () => {
    const scenarios = [
      baseSnapshot({ validated_evidence: [asEvidence(SYNTHETIC_RESOLUTION_FIXTURES.strong_visual_evidence)] }),
      baseSnapshot({ validated_evidence: [asEvidence(SYNTHETIC_RESOLUTION_FIXTURES.limited_evidence)] }),
      baseSnapshot({
        need_type: 'differentiate_possible_non_fire_heat_source',
        validated_evidence: [
          asEvidence({
            ...SYNTHETIC_RESOLUTION_FIXTURES.strong_visual_evidence,
            observation: { possible_non_vegetation_source: 'industrial' },
          }),
        ],
      }),
    ]
    for (const snap of scenarios) {
      const result = evaluateNeedResolution(snap)
      const texts = [
        ...result.resolution_reasons,
        ...result.resolution_limitations,
        ...result.remaining_uncertainties,
        ...result.recommended_follow_up,
        result.alternative_method_recommended ?? '',
      ]
      for (const t of texts) {
        if (t) expect(containsForbiddenResolutionCopy(t)).toBe(false)
      }
    }
  })
})
