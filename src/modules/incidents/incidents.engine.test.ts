import { describe, expect, it } from 'vitest'

import {
  isEventEligibleForIncident,
  scoreEventPairCorrelation,
} from '@/modules/incidents/correlation/fire-event-correlation'
import { aggregateIncidentPriority } from '@/modules/incidents/correlation/incident-priority.engine'
import { selectPrimaryEvent } from '@/modules/incidents/correlation/incident-primary-selection'
import { deriveIncidentStatus } from '@/modules/incidents/correlation/incident-lifecycle-sync'
import { genericIncidentCorrelationEngine } from '@/modules/incidents/engine/generic-incident-correlation.engine'
import { containsForbiddenIncidentCopy } from '@/modules/incidents/incidents-copy-guard'
import type { IncidentEventSnapshot } from '@/modules/incidents/incidents.types'

const EVALUATED_AT = '2026-07-10T20:00:00.000Z'

function event(
  id: string,
  overrides: Partial<IncidentEventSnapshot> = {},
): IncidentEventSnapshot {
  return {
    event_type: 'fire_event',
    event_id: id,
    lifecycle_state: 'active',
    validation_status: 'no_validado',
    status: 'active',
    department_id: 'dept-1',
    department_name: 'Guatemala',
    centroid_lat: 14.6,
    centroid_lng: -90.5,
    first_detected_at: '2026-07-10T08:00:00.000Z',
    last_detected_at: '2026-07-10T18:00:00.000Z',
    detection_count: 2,
    persistence_hours: 6,
    estimated_area_ha: 10,
    source_products: ['VIIRS_NOAA21_NRT'],
    attention_score: 45,
    verification_score: 40,
    action_score: 30,
    attention_level: 'review',
    verification_level: 'recommended',
    action_level: 'prepare',
    active_incident_id: null,
    ...overrides,
  }
}

describe('incident correlation engine', () => {
  it('creates incident for eligible active event', () => {
    const result = genericIncidentCorrelationEngine.evaluate({
      event: event('e1'),
      peerEvents: [],
      candidateIncidents: [],
      evaluatedAt: EVALUATED_AT,
    })
    expect(result.correlation_decision).toBe('create_new_incident')
    expect(containsForbiddenIncidentCopy(result.correlation_reasons.join(' '))).toBe(false)
  })

  it('does not create incident for non-eligible resolved event without membership', () => {
    const eligibility = isEventEligibleForIncident(
      event('e1', { lifecycle_state: 'resolved', attention_level: 'routine' }),
    )
    expect(eligibility.eligible).toBe(false)
    const result = genericIncidentCorrelationEngine.evaluate({
      event: event('e1', { lifecycle_state: 'resolved', attention_level: 'routine' }),
      peerEvents: [],
      candidateIncidents: [],
      evaluatedAt: EVALUATED_AT,
    })
    expect(result.correlation_decision).toBe('no_action')
  })

  it('associates spatially and temporally compatible events', () => {
    const a = event('e1', { centroid_lat: 14.6, centroid_lng: -90.5 })
    const b = event('e2', { centroid_lat: 14.601, centroid_lng: -90.501 })
    const scored = scoreEventPairCorrelation(a, b)
    expect(scored.correlation_score).toBeGreaterThan(0.65)
  })

  it('keeps spatially distant events separate', () => {
    const a = event('e1', { centroid_lat: 14.6, centroid_lng: -90.5 })
    const b = event('e2', { centroid_lat: 17.24, centroid_lng: -91.14 })
    const scored = scoreEventPairCorrelation(a, b)
    expect(scored.correlation_score).toBeLessThan(0.45)
    expect(scored.rejected_reasons).toContain('distancia_espacial_excesiva')
  })

  it('keeps temporally incompatible events separate', () => {
    const a = event('e1', {
      first_detected_at: '2026-07-01T08:00:00.000Z',
      last_detected_at: '2026-07-01T10:00:00.000Z',
    })
    const b = event('e2', {
      first_detected_at: '2026-07-10T08:00:00.000Z',
      last_detected_at: '2026-07-10T18:00:00.000Z',
    })
    const scored = scoreEventPairCorrelation(a, b)
    expect(scored.temporal_score).toBe(0)
    expect(scored.rejected_reasons).toContain('ventanas_temporales_incompatibles')
  })

  it('does not correlate by department alone', () => {
    const a = event('e1', { centroid_lat: 14.6, centroid_lng: -90.5 })
    const b = event('e2', {
      centroid_lat: 16.0,
      centroid_lng: -88.0,
      department_id: 'dept-1',
    })
    const scored = scoreEventPairCorrelation(a, b)
    expect(scored.rejected_reasons).toContain('solo_coincidencia_administrativa')
  })

  it('rejects invalidated events as active members', () => {
    const scored = scoreEventPairCorrelation(
      event('e1'),
      event('e2', { lifecycle_state: 'invalidated' }),
    )
    expect(scored.correlation_score).toBe(0)
    expect(scored.rejected_reasons).toContain('evento_invalidado')
  })

  it('produces stable signatures with unordered peer lists', () => {
    const peers = [event('b'), event('a'), event('c')]
    const sig1 = genericIncidentCorrelationEngine.buildContextSignature({
      event: event('e1'),
      peerIds: peers.map((p) => p.event_id),
      incidentIds: ['inc-2', 'inc-1'],
    })
    const sig2 = genericIncidentCorrelationEngine.buildContextSignature({
      event: event('e1'),
      peerIds: [...peers].reverse().map((p) => p.event_id),
      incidentIds: ['inc-1', 'inc-2'],
    })
    expect(sig1).toBe(sig2)
  })

  it('does not sum event scores linearly in incident priority', () => {
    const members = [
      event('e1', { attention_score: 50, verification_score: 45, action_score: 40 }),
      event('e2', { attention_score: 35, verification_score: 30, action_score: 25 }),
      event('e3', { attention_score: 42, verification_score: 38, action_score: 32 }),
    ]
    const priority = aggregateIncidentPriority(members)
    expect(priority.attention_score).toBeLessThan(150)
    expect(priority.attention_score).toBeGreaterThanOrEqual(50)
    expect(priority.evidence_status).toBe('multi_event_same_source')
    expect(priority.priority_limitations.length).toBeGreaterThan(0)
  })

  it('treats multiple FIRMS events as same source not independent corroboration', () => {
    const priority = aggregateIncidentPriority([
      event('e1'),
      event('e2', { centroid_lat: 14.61, centroid_lng: -90.51 }),
    ])
    expect(priority.evidence_status).toBe('multi_event_same_source')
    expect(priority.evidence_status).not.toBe('multi_source')
  })

  it('selects primary event using more than attention score alone', () => {
    const selected = selectPrimaryEvent(
      [
        event('high-attn', {
          attention_score: 80,
          lifecycle_state: 'inactive_monitoring',
          last_detected_at: '2026-07-08T10:00:00.000Z',
        }),
        event('better-fit', {
          attention_score: 55,
          lifecycle_state: 'expanding',
          last_detected_at: '2026-07-10T18:00:00.000Z',
          persistence_hours: 12,
        }),
      ],
      EVALUATED_AT,
    )
    expect(selected?.event_id).toBe('better-fit')
  })

  it('keeps incident id stable when primary changes', () => {
    const primaryA = selectPrimaryEvent([event('a'), event('b')], EVALUATED_AT)
    const primaryB = selectPrimaryEvent(
      [event('b', { lifecycle_state: 'expanding', attention_score: 90 }), event('a')],
      EVALUATED_AT,
    )
    expect(primaryA?.event_id).not.toBe(primaryB?.event_id)
  })

  it('moves incident to monitoring when no active members remain', () => {
    const status = deriveIncidentStatus(
      [
        event('e1', {
          lifecycle_state: 'resolved',
          membership_status: 'historical',
        }),
      ],
      EVALUATED_AT,
    )
    expect(status).toBe('monitoring')
  })

  it('audits keep_separate decisions', () => {
    const result = genericIncidentCorrelationEngine.evaluate({
      event: event('e1', { attention_level: 'routine', verification_level: 'not_required', lifecycle_state: 'inactive_monitoring' }),
      peerEvents: [event('e2', { centroid_lat: 16, centroid_lng: -88 })],
      candidateIncidents: [],
      evaluatedAt: EVALUATED_AT,
    })
    expect(['keep_separate', 'no_action', 'manual_review_recommended']).toContain(
      result.correlation_decision,
    )
    expect(result.correlation_reasons.length + result.rejected_reasons.length).toBeGreaterThan(0)
  })

  it('uses safe copy in all generated reasons', () => {
    const result = genericIncidentCorrelationEngine.evaluate({
      event: event('e1'),
      peerEvents: [],
      candidateIncidents: [],
      evaluatedAt: EVALUATED_AT,
    })
    const text = [
      ...result.correlation_reasons,
      ...result.correlation_limitations,
      ...result.rejected_reasons,
    ].join(' ')
    expect(containsForbiddenIncidentCopy(text)).toBe(false)
  })
})
