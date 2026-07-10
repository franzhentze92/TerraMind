import { describe, expect, it } from 'vitest'

import { genericVerificationPlanningEngine } from '@/modules/verification/engine/generic-verification-planning.engine'
import { deriveVerificationNeeds } from '@/modules/verification/engine/verification-need-derivation'
import {
  dedupeMethodsAcrossNeeds,
  rankMethodsForNeed,
} from '@/modules/verification/engine/verification-method-ranking'
import { containsForbiddenVerificationCopy } from '@/modules/verification/verification-copy-guard'
import { sortNeedsDeterministic, type IncidentVerificationSnapshot } from '@/modules/verification/verification.types'
import { FIRE_VERIFICATION_METHOD_CATALOG } from '@/modules/verification/config/fire-verification.config'

const EVALUATED_AT = '2026-07-10T20:00:00.000Z'

function snapshot(overrides: Partial<IncidentVerificationSnapshot> = {}): IncidentVerificationSnapshot {
  return {
    incident_id: 'inc-1',
    incident_status: 'open',
    incident_type: 'fire_situation',
    domain: 'fire',
    evidence_status: 'thermal_only',
    verification_score: 55,
    verification_level: 'recommended',
    attention_score: 50,
    action_score: 25,
    action_level: 'prepare',
    plan_limitations: [],
    priority_limitations: [],
    first_observed_at: '2026-07-10T08:00:00.000Z',
    last_observed_at: '2026-07-10T18:00:00.000Z',
    primary_event_id: 'e1',
    active_event_count: 1,
    event_count: 1,
    members: [
      {
        event_id: 'e1',
        lifecycle_state: 'active',
        last_detected_at: '2026-07-10T18:00:00.000Z',
        attention_score: 50,
        verification_score: 55,
        source_products: ['VIIRS_NOAA21_NRT'],
        context_availability: { land_cover: 'complete', population: 'complete' },
        finding_limitations: [],
      },
    ],
    component_evidence_states: [],
    active_findings: [],
    ...overrides,
  }
}

describe('verification planning engine', () => {
  it('produces not_required for low verification incident', () => {
    const result = genericVerificationPlanningEngine.evaluate({
      snapshot: snapshot({
        verification_score: 15,
        verification_level: 'useful',
        last_observed_at: '2026-07-08T08:00:00.000Z',
        members: [
          {
            event_id: 'e1',
            lifecycle_state: 'inactive_monitoring',
            last_detected_at: '2026-07-08T08:00:00.000Z',
            attention_score: 10,
            verification_score: 15,
            source_products: ['VIIRS_NOAA21_NRT'],
            context_availability: {},
            finding_limitations: [],
          },
        ],
      }),
      evaluatedAt: EVALUATED_AT,
    })
    expect(result.status).toBe('not_required')
    expect(result.needs).toHaveLength(0)
  })

  it('produces explicit needs for high uncertainty', () => {
    const result = genericVerificationPlanningEngine.evaluate({
      snapshot: snapshot({ verification_score: 65, verification_level: 'high_priority' }),
      evaluatedAt: EVALUATED_AT,
    })
    expect(result.needs.length).toBeGreaterThan(0)
    expect(result.needs.some((n) => n.need_type === 'obtain_visual_ground_evidence')).toBe(true)
  })

  it('does not create need for non-material missing climate context', () => {
    const needs = deriveVerificationNeeds(
      snapshot({
        component_evidence_states: [
          { component: 'climate', state: 'missing_context', note: 'Clima no disponible' },
        ],
      }),
      EVALUATED_AT,
    )
    expect(needs.some((n) => n.need_type === 'clarify_land_cover_context')).toBe(false)
    expect(needs.every((n) => !n.need_question.includes('clima'))).toBe(true)
  })

  it('creates action-cap unlock need when verification high but action capped', () => {
    const needs = deriveVerificationNeeds(
      snapshot({
        action_level: 'none',
        verification_score: 38,
        verification_level: 'useful',
      }),
      EVALUATED_AT,
    )
    expect(needs.some((n) => n.need_type === 'obtain_visual_ground_evidence')).toBe(true)
    expect(
      needs.some((n) =>
        n.derivation_reasons.some((r) => r.toLowerCase().includes('desbloquear')),
      ),
    ).toBe(true)
  })

  it('recommends short-window method for recent event', () => {
    const need = deriveVerificationNeeds(snapshot(), EVALUATED_AT).find(
      (n) => n.need_type === 'confirm_recent_activity',
    )!
    const ranked = rankMethodsForNeed(need, 2)
    expect(ranked.recommended?.method_id).toBe('review_latest_thermal_detections')
  })

  it('does not recommend urgent field inspection for old event without justification', () => {
    const needs = deriveVerificationNeeds(
      snapshot({ last_observed_at: '2026-07-09T12:00:00.000Z' }),
      EVALUATED_AT,
    )
    const persistence = needs.find((n) => n.need_type === 'assess_event_persistence')
    expect(persistence).toBeDefined()
    const ranked = rankMethodsForNeed(persistence!, 32)
    expect(ranked.recommended?.method_id).not.toBe('field_visual_inspection')
  })

  it('marks unavailable method as blocked', () => {
    const catalog = FIRE_VERIFICATION_METHOD_CATALOG.map((m) =>
      m.method_id === 'drone_observation' ? { ...m, availability_status: 'unavailable' as const } : m,
    )
    const need = deriveVerificationNeeds(snapshot(), EVALUATED_AT)[0]
    const ranked = rankMethodsForNeed(need, 2, catalog)
    const drone = [...(ranked.recommended ? [ranked.recommended] : []), ...ranked.alternatives].find(
      (m) => m.method_id === 'drone_observation',
    )
    if (drone) expect(drone.is_blocked).toBe(true)
  })

  it('does not always pick highest evidence strength when window is short', () => {
    const need = {
      need_type: 'confirm_recent_activity' as const,
      need_question: 'test',
      priority: 80,
      derivation_reasons: [],
      evidence_minimum: [],
      success_criteria: '',
      inconclusive_criteria: '',
      failure_criteria: '',
      recommended_window_hours: 6,
    }
    const ranked = rankMethodsForNeed(need, 2)
    expect(ranked.recommended?.method_id).not.toBe('georeferenced_photo_collection')
  })

  it('dedupes method across multiple needs', () => {
    const needs = [
      {
        need_type: 'confirm_recent_activity' as const,
        recommended_method: {
          method_id: 'review_latest_thermal_detections',
          method_type: 'remote_analytical',
          is_recommended: true,
          is_alternative: false,
          is_blocked: false,
          suitability_score: 1,
          information_gain_score: 0.7,
          urgency_fit_score: 0.9,
          cost_efficiency_score: 1,
          availability_score: 1,
          evidence_strength_score: 0.55,
          ranking_reasons: [],
          ranking_limitations: [],
          constraints: [],
        },
        alternative_methods: [],
      },
      {
        need_type: 'assess_event_persistence' as const,
        recommended_method: {
          method_id: 'review_latest_thermal_detections',
          method_type: 'remote_analytical',
          is_recommended: true,
          is_alternative: false,
          is_blocked: false,
          suitability_score: 1,
          information_gain_score: 0.7,
          urgency_fit_score: 0.9,
          cost_efficiency_score: 1,
          availability_score: 1,
          evidence_strength_score: 0.55,
          ranking_reasons: [],
          ranking_limitations: [],
          constraints: [],
        },
        alternative_methods: [
          {
            method_id: 'review_time_series',
            method_type: 'remote_analytical',
            is_recommended: false,
            is_alternative: true,
            is_blocked: false,
            suitability_score: 1,
            information_gain_score: 0.75,
            urgency_fit_score: 0.8,
            cost_efficiency_score: 1,
            availability_score: 1,
            evidence_strength_score: 0.6,
            ranking_reasons: [],
            ranking_limitations: [],
            constraints: [],
          },
        ],
      },
    ]
    dedupeMethodsAcrossNeeds(needs)
    const ids = needs.map((n) => n.recommended_method?.method_id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('flags FIRMS-only source diversity limitation', () => {
    const needs = deriveVerificationNeeds(snapshot(), EVALUATED_AT)
    expect(
      needs.some((n) => n.need_type === 'differentiate_possible_non_fire_heat_source'),
    ).toBe(true)
  })

  it('does not auto-satisfy resolution on absence of detection', () => {
    const result = genericVerificationPlanningEngine.evaluate({
      snapshot: snapshot({ incident_status: 'resolved' }),
      evaluatedAt: EVALUATED_AT,
    })
    const resolution = result.needs.find((n) => n.need_type === 'verify_incident_resolution')
    expect(resolution?.inconclusive_criteria).toContain('insuficiente')
  })

  it('produces same plan for shuffled member order', () => {
    const a = genericVerificationPlanningEngine.evaluate({
      snapshot: snapshot({
        members: [
          {
            event_id: 'e2',
            lifecycle_state: 'active',
            last_detected_at: '2026-07-10T18:00:00.000Z',
            attention_score: 50,
            verification_score: 55,
            source_products: ['VIIRS_NOAA21_NRT'],
            context_availability: {},
            finding_limitations: [],
          },
          {
            event_id: 'e1',
            lifecycle_state: 'active',
            last_detected_at: '2026-07-10T17:00:00.000Z',
            attention_score: 45,
            verification_score: 50,
            source_products: ['VIIRS_NOAA21_NRT'],
            context_availability: {},
            finding_limitations: [],
          },
        ],
      }),
      evaluatedAt: EVALUATED_AT,
    })
    const b = genericVerificationPlanningEngine.evaluate({
      snapshot: snapshot({
        members: [
          {
            event_id: 'e1',
            lifecycle_state: 'active',
            last_detected_at: '2026-07-10T17:00:00.000Z',
            attention_score: 45,
            verification_score: 50,
            source_products: ['VIIRS_NOAA21_NRT'],
            context_availability: {},
            finding_limitations: [],
          },
          {
            event_id: 'e2',
            lifecycle_state: 'active',
            last_detected_at: '2026-07-10T18:00:00.000Z',
            attention_score: 50,
            verification_score: 55,
            source_products: ['VIIRS_NOAA21_NRT'],
            context_availability: {},
            finding_limitations: [],
          },
        ],
      }),
      evaluatedAt: EVALUATED_AT,
    })
    expect(a.context_signature).toBe(b.context_signature)
    expect(a.needs.map((n) => n.need_type)).toEqual(b.needs.map((n) => n.need_type))
  })

  it('sorts needs deterministically', () => {
    const needs = deriveVerificationNeeds(snapshot(), EVALUATED_AT)
    const sorted1 = sortNeedsDeterministic(needs)
    const sorted2 = sortNeedsDeterministic([...needs].reverse())
    expect(sorted1.map((n) => n.need_type)).toEqual(sorted2.map((n) => n.need_type))
  })

  it('resolved incident produces verify_incident_resolution', () => {
    const result = genericVerificationPlanningEngine.evaluate({
      snapshot: snapshot({ incident_status: 'resolved', verification_score: 10 }),
      evaluatedAt: EVALUATED_AT,
    })
    expect(result.needs.some((n) => n.need_type === 'verify_incident_resolution')).toBe(true)
  })

  it('sets mission_candidate_pending for ready plans', () => {
    const result = genericVerificationPlanningEngine.evaluate({
      snapshot: snapshot(),
      evaluatedAt: EVALUATED_AT,
    })
    if (result.status === 'ready') {
      expect(result.mission_candidate_pending).toBe(true)
    }
  })

  it('uses no forbidden copy in outputs', () => {
    const result = genericVerificationPlanningEngine.evaluate({
      snapshot: snapshot(),
      evaluatedAt: EVALUATED_AT,
    })
    const text = [
      ...result.plan_reasons,
      ...result.plan_limitations,
      ...result.needs.flatMap((n) => [
        n.need_question,
        n.selection_reason,
        ...n.derivation_reasons,
        ...(n.recommended_method?.ranking_reasons ?? []),
      ]),
    ].join(' ')
    expect(containsForbiddenVerificationCopy(text)).toBe(false)
  })
})
