import { describe, expect, it } from 'vitest'
import type { CompositeFinding } from '@/modules/findings/findings.types'
import { firePriorityEngine } from '@/modules/priorities/engine/fire-priority.engine'
import { containsForbiddenPriorityCopy } from '@/modules/priorities/priorities-copy-guard'
import type {
  FirePriorityEventContext,
  PriorityEvaluationInput,
} from '@/modules/priorities/priorities.types'

function baseEvent(overrides: Partial<FirePriorityEventContext> = {}): FirePriorityEventContext {
  const now = new Date().toISOString()
  return {
    id: 'event-1',
    department_code: '01',
    department_name: 'Guatemala',
    status: 'active',
    validation_status: 'no_validado',
    detection_count: 3,
    first_detected_at: now,
    last_detected_at: now,
    persistence_hours: 4,
    context_availability: {
      protected_area: 'complete',
      land_cover: 'complete',
      population: 'partial',
      climate: 'complete',
      biodiversity: 'partial',
    },
    context_version: 'ctx-v1',
    rule_set_version: '1.0.0',
    ...overrides,
  }
}

function finding(
  type: CompositeFinding['finding_type'],
  overrides: Partial<CompositeFinding> = {},
): CompositeFinding {
  return {
    finding_type: type,
    entity_type: 'fire_event',
    entity_id: 'event-1',
    title: String(type),
    summary: 'Resumen de prueba',
    status: 'active',
    severity_label: 'attention',
    confidence: { level: 'moderate', reasons: [] },
    evidence: [],
    triggered_rules: [`RULE_${type}`],
    source_domains: ['protected_areas'],
    geographic_context: {},
    temporal_context: {},
    limitations: [],
    recommended_actions: [],
    generated_at: new Date().toISOString(),
    context_version: 'ctx-v1',
    rule_set_version: '1.0.0',
    ...overrides,
  }
}

function evaluate(
  findings: CompositeFinding[],
  eventOverrides: Partial<FirePriorityEventContext> = {},
  previous?: PriorityEvaluationInput['previous_assessment'],
) {
  return firePriorityEngine.evaluateFireEventPriority({
    entity_type: 'fire_event',
    entity_id: 'event-1',
    event: baseEvent(eventOverrides),
    findings,
    evaluated_at: '2026-07-10T20:00:00.000Z',
    previous_assessment: previous,
  })
}

describe('fire priority engine', () => {
  it('does not double-count protected area when multi_context is present', () => {
    const result = evaluate([
      finding('thermal_activity_in_protected_area', {
        severity_label: 'elevated_attention',
        confidence: { level: 'high', reasons: [] },
      }),
      finding('thermal_activity_on_forest_cover', {
        source_domains: ['land_cover'],
        confidence: { level: 'high', reasons: [] },
      }),
      finding('documented_biodiversity_near_event', {
        source_domains: ['biodiversity'],
        confidence: { level: 'moderate', reasons: [] },
      }),
      finding('multi_context_attention', {
        source_domains: ['protected_areas', 'land_cover', 'biodiversity'],
        confidence: { level: 'moderate', reasons: [] },
      }),
    ])

    const protectedContribution =
      result.assessment.domain_contributions.protected_areas ?? 0
    expect(protectedContribution).toBeLessThanOrEqual(20)
    expect(result.assessment.score_explanation.concurrency_bonus.applied).toBe(true)
    const multiSnapshot = result.assessment.finding_snapshot.find(
      (f) => f.finding_type === 'multi_context_attention',
    )
    expect(multiSnapshot?.accepted_contribution ?? 0).toBe(0)
    expect(multiSnapshot?.discard_reason).toContain('bonus')
  })

  it('substitutes near protected area when inside protected area exists', () => {
    const result = evaluate([
      finding('thermal_activity_in_protected_area'),
      finding('thermal_activity_near_protected_area'),
    ])
    const discarded = result.assessment.score_explanation.discarded_by_redundancy
    expect(discarded.some((d) => d.finding_type === 'thermal_activity_near_protected_area')).toBe(
      true,
    )
  })

  it('raises verification without necessarily raising action when confidence is low', () => {
    const result = evaluate([
      finding('thermal_activity_in_protected_area', {
        severity_label: 'elevated_attention',
        confidence: { level: 'low', reasons: ['partial'] },
      }),
      finding('nearby_population_with_high_uncertainty', {
        source_domains: ['population'],
        confidence: { level: 'low', reasons: ['divergence'] },
      }),
    ])

    expect(result.assessment.verification_score).toBeGreaterThan(result.assessment.action_score)
    expect(result.assessment.action_score).toBeLessThanOrEqual(55)
  })

  it('reduces urgency for older detections via decay', () => {
    const recent = evaluate([finding('thermal_activity_on_forest_cover')], {
      last_detected_at: '2026-07-10T19:00:00.000Z',
    })
    const old = evaluate([finding('thermal_activity_on_forest_cover')], {
      last_detected_at: '2026-07-08T19:00:00.000Z',
    })
    expect(old.assessment.attention_score).toBeLessThan(recent.assessment.attention_score)
    expect(old.assessment.score_explanation.decay.applied).toBe(true)
  })

  it('marks missing context without treating it as favorable evidence', () => {
    const result = evaluate([finding('thermal_activity_on_forest_cover')], {
      context_availability: {
        protected_area: 'missing',
        land_cover: 'complete',
        population: 'missing',
        climate: 'missing',
        biodiversity: 'missing',
      },
    })
    const states = result.assessment.score_explanation.component_evidence_states
    expect(states.some((s) => s.component === 'population' && s.state === 'missing_context')).toBe(
      true,
    )
    expect(result.assessment.priority_limitations.some((l) => l.includes('Población'))).toBe(true)
  })

  it('produces identical output regardless of finding order', () => {
    const findingsA = [
      finding('thermal_activity_in_protected_area'),
      finding('thermal_activity_on_forest_cover', { source_domains: ['land_cover'] }),
      finding('dry_conditions_around_thermal_event', { source_domains: ['climate'] }),
    ]
    const findingsB = [...findingsA].reverse()
    const a = evaluate(findingsA)
    const b = evaluate(findingsB)
    expect(a.assessment.attention_score).toBe(b.assessment.attention_score)
    expect(a.assessment.verification_score).toBe(b.assessment.verification_score)
    expect(a.assessment.action_score).toBe(b.assessment.action_score)
  })

  it('tracks score delta and level change from previous assessment', () => {
    const prevResult = evaluate([finding('thermal_activity_near_protected_area')])
    const prev = { ...prevResult.assessment, id: 'prev-assessment-id' }
    const next = evaluate(
      [finding('thermal_activity_in_protected_area', { confidence: { level: 'high', reasons: [] } })],
      {},
      prev,
    )
    expect(next.assessment.score_delta.attention_delta).not.toBe(0)
    expect(next.assessment.change_reasons.length).toBeGreaterThan(0)
  })

  it('keeps scores within 0-100', () => {
    const result = evaluate([
      finding('thermal_activity_in_protected_area', { confidence: { level: 'high', reasons: [] } }),
      finding('thermal_activity_on_forest_cover', { source_domains: ['land_cover'] }),
      finding('dry_conditions_around_thermal_event', { source_domains: ['climate'] }),
      finding('strong_wind_during_thermal_event', { source_domains: ['climate'] }),
      finding('nearby_population_with_reliable_estimate', { source_domains: ['population'] }),
      finding('documented_biodiversity_near_event', { source_domains: ['biodiversity'] }),
    ])
    expect(result.assessment.attention_score).toBeGreaterThanOrEqual(0)
    expect(result.assessment.attention_score).toBeLessThanOrEqual(100)
    expect(result.assessment.verification_score).toBeLessThanOrEqual(100)
    expect(result.assessment.action_score).toBeLessThanOrEqual(100)
  })

  it('blocks forbidden priority copy', () => {
    expect(containsForbiddenPriorityCopy('población en riesgo')).toBe(true)
    expect(containsForbiddenPriorityCopy('Revisar últimas detecciones')).toBe(false)
  })
})

/** Fixtures sintéticos: demuestran que todos los niveles del modelo son alcanzables. */
function caseAFindings(): CompositeFinding[] {
  return [
    finding('thermal_activity_in_protected_area', {
      severity_label: 'elevated_attention',
      confidence: { level: 'high', reasons: [] },
    }),
    finding('thermal_activity_on_forest_cover', {
      source_domains: ['land_cover'],
      confidence: { level: 'high', reasons: [] },
    }),
    finding('dry_conditions_around_thermal_event', {
      source_domains: ['climate'],
      confidence: { level: 'high', reasons: [] },
    }),
    finding('strong_wind_during_thermal_event', {
      source_domains: ['climate'],
      confidence: { level: 'high', reasons: [] },
    }),
    finding('nearby_population_with_reliable_estimate', {
      source_domains: ['population'],
      confidence: { level: 'high', reasons: [] },
    }),
    finding('documented_biodiversity_near_event', {
      source_domains: ['biodiversity'],
      confidence: { level: 'high', reasons: [] },
    }),
    finding('multi_context_attention', {
      source_domains: ['protected_areas', 'land_cover', 'biodiversity'],
      confidence: { level: 'high', reasons: [] },
    }),
  ]
}

describe('fire priority model v1.0.0 — synthetic level reachability', () => {
  it('Case A: evento reciente con evidencia completa alcanza high_attention o superior', () => {
    const result = evaluate(caseAFindings(), {
      status: 'active',
      validation_status: 'no_validado',
      detection_count: 14,
      persistence_hours: 10,
      last_detected_at: '2026-07-10T19:55:00.000Z',
      context_availability: {
        protected_area: 'complete',
        land_cover: 'complete',
        population: 'complete',
        climate: 'complete',
        biodiversity: 'complete',
      },
    })

    expect(['high_attention', 'priority_attention']).toContain(result.assessment.attention_level)
    expect(result.assessment.attention_score).toBeGreaterThanOrEqual(60)
    expect(result.assessment.score_explanation.decay.decay_points).toBeLessThan(3)
  })

  it('Case B: alta severidad potencial con incertidumbre eleva verificación sin elevar acción', () => {
    const result = evaluate(
      [
        finding('thermal_activity_in_protected_area', {
          severity_label: 'elevated_attention',
          confidence: { level: 'low', reasons: ['partial'] },
        }),
        finding('thermal_activity_on_forest_cover', {
          source_domains: ['land_cover'],
          confidence: { level: 'low', reasons: ['partial'] },
        }),
        finding('nearby_population_with_high_uncertainty', {
          source_domains: ['population'],
          confidence: { level: 'low', reasons: ['divergence'] },
        }),
        finding('biodiversity_context_limited', {
          source_domains: ['biodiversity'],
          confidence: { level: 'low', reasons: ['partial provider'] },
        }),
      ],
      {
        context_availability: {
          protected_area: 'complete',
          land_cover: 'partial',
          population: 'partial',
          climate: 'missing',
          biodiversity: 'partial',
        },
      },
    )

    expect(result.assessment.attention_score).toBeGreaterThanOrEqual(45)
    expect(['recommended', 'high_priority']).toContain(result.assessment.verification_level)
    expect(result.assessment.verification_score).toBeGreaterThanOrEqual(40)
    expect(result.assessment.verification_score).toBeGreaterThan(result.assessment.action_score)
    expect(result.assessment.action_score).toBeLessThanOrEqual(55)
  })

  it('Case C: evento antiguo y aislado queda en routine con acción none', () => {
    const result = evaluate([finding('thermal_activity_near_protected_area')], {
      status: 'monitoring',
      detection_count: 1,
      persistence_hours: 0.5,
      last_detected_at: '2026-07-07T20:00:00.000Z',
      context_availability: {
        protected_area: 'complete',
        land_cover: 'missing',
        population: 'missing',
        climate: 'missing',
        biodiversity: 'missing',
      },
    })

    expect(result.assessment.attention_level).toBe('routine')
    expect(result.assessment.action_level).toBe('none')
    expect(['not_required', 'useful']).toContain(result.assessment.verification_level)
    expect(result.assessment.score_explanation.decay.applied).toBe(true)
  })

  it('Case D: evento confirmado puede superar action cap y alcanzar operational_attention', () => {
    const unconfirmed = evaluate(caseAFindings(), {
      validation_status: 'no_validado',
      detection_count: 14,
      persistence_hours: 10,
      last_detected_at: '2026-07-10T19:55:00.000Z',
      context_availability: {
        protected_area: 'complete',
        land_cover: 'complete',
        population: 'complete',
        climate: 'complete',
        biodiversity: 'complete',
      },
    })

    const confirmed = evaluate(caseAFindings(), {
      validation_status: 'confirmado',
      detection_count: 14,
      persistence_hours: 10,
      last_detected_at: '2026-07-10T19:55:00.000Z',
      context_availability: {
        protected_area: 'complete',
        land_cover: 'complete',
        population: 'complete',
        climate: 'complete',
        biodiversity: 'complete',
      },
    })

    expect(unconfirmed.assessment.action_score).toBeLessThanOrEqual(55)
    expect(confirmed.assessment.action_score).toBeGreaterThan(unconfirmed.assessment.action_score)
    expect(confirmed.assessment.action_level).toBe('operational_attention')
    expect(confirmed.assessment.score_explanation.confidence_modifiers.action_cap).toBe(100)
  })

  it('priority_attention es alcanzable con concurrencia máxima y persistencia fuerte', () => {
    const result = evaluate(caseAFindings(), {
      status: 'active',
      validation_status: 'confirmado',
      detection_count: 24,
      persistence_hours: 18,
      last_detected_at: '2026-07-10T19:59:00.000Z',
      context_availability: {
        protected_area: 'complete',
        land_cover: 'complete',
        population: 'complete',
        climate: 'complete',
        biodiversity: 'complete',
      },
    })

    expect(result.assessment.attention_level).toBe('priority_attention')
    expect(result.assessment.attention_score).toBeGreaterThanOrEqual(75)
  })

  it('verification high_priority es alcanzable bajo incertidumbre extrema sin confirmación', () => {
    const uncertainCaseA = caseAFindings().map((f) => ({
      ...f,
      confidence: { level: 'low' as const, reasons: ['evidencia limitada'] },
    }))

    const result = evaluate(
      [
        ...uncertainCaseA,
        finding('nearby_population_with_high_uncertainty', {
          source_domains: ['population'],
          confidence: { level: 'low', reasons: [] },
        }),
        finding('biodiversity_context_limited', {
          source_domains: ['biodiversity'],
          confidence: { level: 'low', reasons: [] },
        }),
      ],
      {
        detection_count: 10,
        persistence_hours: 6,
        last_detected_at: '2026-07-10T19:30:00.000Z',
        context_availability: {
          protected_area: 'partial',
          land_cover: 'partial',
          population: 'partial',
          climate: 'partial',
          biodiversity: 'partial',
        },
      },
    )

    expect(result.assessment.verification_level).toBe('high_priority')
    expect(result.assessment.verification_score).toBeGreaterThanOrEqual(60)
    expect(result.assessment.action_score).toBeLessThanOrEqual(55)
  })
})
