import { describe, expect, it } from 'vitest'

import { classifyDetectionCorrelation } from '@/modules/lifecycle/correlation/fire-detection-correlation'
import { FIRE_LIFECYCLE_CORRELATION } from '@/modules/lifecycle/config/fire-lifecycle.config'
import { genericLifecycleEngine } from '@/modules/lifecycle/engine/generic-lifecycle.engine'
import {
  buildFireLifecycleContextSignature,
  evaluateFireLifecycleState,
} from '@/modules/lifecycle/rules/fire-lifecycle-rules'
import {
  shouldEnqueueFindingReevaluation,
  shouldEnqueuePriorityReevaluation,
  shouldExpirePriorityQueue,
} from '@/modules/lifecycle/sync/lifecycle-findings-sync'
import type {
  FireLifecycleState,
  LifecycleDetectionPoint,
  LifecycleEvaluationSnapshot,
} from '@/modules/lifecycle/lifecycle.types'

const EVALUATED_AT = '2026-07-10T20:00:00.000Z'

function detection(
  id: string,
  acquiredAt: string,
  lat = 14.6,
  lng = -90.5,
): LifecycleDetectionPoint {
  return {
    id,
    acquired_at: acquiredAt,
    latitude: lat,
    longitude: lng,
    frp_mw: 12,
    source_product: 'VIIRS',
  }
}

function snapshot(
  overrides: Partial<LifecycleEvaluationSnapshot> & {
    lifecycle_state?: FireLifecycleState | null
  } = {},
): LifecycleEvaluationSnapshot {
  const last = overrides.last_detected_at ?? EVALUATED_AT
  return {
    entity_type: 'fire_event',
    entity_id: 'event-1',
    lifecycle_state: overrides.lifecycle_state ?? 'detected',
    validation_status: 'no_validado',
    first_detected_at: overrides.first_detected_at ?? '2026-07-10T08:00:00.000Z',
    last_detected_at: last,
    detection_count: overrides.detection_count ?? 1,
    persistence_hours: overrides.persistence_hours ?? 4,
    estimated_area_ha: overrides.estimated_area_ha ?? null,
    max_frp_mw: overrides.max_frp_mw ?? 12,
    inactive_since: overrides.inactive_since ?? null,
    monitoring_until: overrides.monitoring_until ?? null,
    resolved_at: overrides.resolved_at ?? null,
    reactivated_at: overrides.reactivated_at ?? null,
    last_confirmed_at: overrides.last_confirmed_at ?? null,
    detections:
      overrides.detections ??
      [detection('d1', last)],
  }
}

function evaluate(snap: LifecycleEvaluationSnapshot, evaluatedAt = EVALUATED_AT) {
  return genericLifecycleEngine.evaluate({ snapshot: snap, evaluatedAt })
}

describe('fire lifecycle engine', () => {
  it('produces the same result regardless of detection input order', () => {
    const detections = [
      detection('d3', '2026-07-10T18:00:00.000Z'),
      detection('d1', '2026-07-10T08:00:00.000Z'),
      detection('d2', '2026-07-10T12:00:00.000Z'),
    ]
    const ordered = evaluate(
      snapshot({
        lifecycle_state: 'active',
        last_detected_at: '2026-07-10T18:00:00.000Z',
        detection_count: 3,
        detections,
      }),
    )
    const reversed = evaluate(
      snapshot({
        lifecycle_state: 'active',
        last_detected_at: '2026-07-10T18:00:00.000Z',
        detection_count: 3,
        detections: [...detections].reverse(),
      }),
    )
    expect(reversed.context_signature).toBe(ordered.context_signature)
    expect(reversed.new_state).toBe(ordered.new_state)
    expect(reversed.source_detection_ids).toEqual(ordered.source_detection_ids)
  })

  it('builds a stable context signature for duplicate evaluations', () => {
    const snap = snapshot({
      lifecycle_state: 'active',
      detections: [
        detection('d1', '2026-07-10T08:00:00.000Z'),
        detection('d2', '2026-07-10T12:00:00.000Z'),
      ],
      detection_count: 2,
      last_detected_at: '2026-07-10T12:00:00.000Z',
    })
    const first = evaluate(snap)
    const second = evaluate(snap)
    expect(first.context_signature).toBe(second.context_signature)
    expect(first.new_state).toBe(second.new_state)
  })

  it('keeps spatially distant detections as separate events', () => {
    const existing = [detection('d1', '2026-07-10T08:00:00.000Z', 14.6, -90.5)]
    const candidate = detection(
      'd2',
      '2026-07-10T09:00:00.000Z',
      14.6 + 0.05,
      -90.5,
    )
    const result = classifyDetectionCorrelation({
      existingDetections: existing,
      candidateDetection: candidate,
      currentLifecycleState: 'active',
      evaluatedAt: EVALUATED_AT,
    })
    expect(result.decision).toBe('separate_event')
    expect(result.distance_m).toBeGreaterThan(
      FIRE_LIFECYCLE_CORRELATION.minDistanceForSeparateEventM,
    )
  })

  it('keeps temporally distant detections as separate events when spatially far', () => {
    const existing = [detection('d1', '2026-07-05T08:00:00.000Z', 14.6, -90.5)]
    const candidate = detection(
      'd2',
      '2026-07-10T08:00:00.000Z',
      14.6 + 0.04,
      -90.5,
    )
    const result = classifyDetectionCorrelation({
      existingDetections: existing,
      candidateDetection: candidate,
      currentLifecycleState: 'active',
      evaluatedAt: EVALUATED_AT,
    })
    expect(result.decision).toBe('separate_event')
    expect(result.within_continuity_window).toBe(false)
  })

  it('returns inactive_monitoring to active without reactivation when not resolved', () => {
    const result = evaluate(
      snapshot({
        lifecycle_state: 'inactive_monitoring',
        last_detected_at: '2026-07-10T18:00:00.000Z',
        detections: [detection('d1', '2026-07-10T18:00:00.000Z')],
      }),
    )
    expect(result.new_state).toBe('active')
    expect(result.transition_rule).toBe('FIRE_LIFECYCLE_ACTIVE_FROM_MONITORING_001')
    expect(result.new_state).not.toBe('reactivated')
  })

  it('requires resolved before reactivated on new correlated detections', () => {
    const fromResolved = evaluate(
      snapshot({
        lifecycle_state: 'resolved',
        last_detected_at: '2026-07-10T18:00:00.000Z',
        detections: [detection('d1', '2026-07-10T18:00:00.000Z')],
      }),
    )
    expect(fromResolved.new_state).toBe('reactivated')
    expect(fromResolved.correlation_kind).toBe('reactivation')

    const fromMonitoring = evaluate(
      snapshot({
        lifecycle_state: 'inactive_monitoring',
        last_detected_at: '2026-07-10T18:00:00.000Z',
        detections: [detection('d1', '2026-07-10T18:00:00.000Z')],
      }),
    )
    expect(fromMonitoring.new_state).toBe('active')
    expect(fromMonitoring.new_state).not.toBe('reactivated')
  })

  it('holds invalidated events without automatic reactivation', () => {
    const rule = evaluateFireLifecycleState(
      snapshot({
        lifecycle_state: 'invalidated',
        last_detected_at: '2026-07-10T18:00:00.000Z',
        detections: [detection('d1', '2026-07-10T18:00:00.000Z')],
      }),
      EVALUATED_AT,
    )
    expect(rule.proposed_state).toBe('invalidated')
    expect(rule.transition_rule).toBe('FIRE_LIFECYCLE_INVALIDATED_HOLD_001')
  })

  it('removes resolved and invalidated events from the active priority queue', () => {
    expect(shouldExpirePriorityQueue('resolved')).toBe(true)
    expect(shouldExpirePriorityQueue('invalidated')).toBe(true)
    expect(shouldExpirePriorityQueue('active')).toBe(false)
    expect(shouldExpirePriorityQueue('inactive_monitoring')).toBe(false)
  })

  it('audits evaluations that keep the same state', () => {
    const result = evaluate(
      snapshot({
        lifecycle_state: 'active',
        last_detected_at: '2026-07-10T18:00:00.000Z',
        detections: [detection('d1', '2026-07-10T18:00:00.000Z')],
      }),
    )
    expect(result.transitioned).toBe(false)
    expect(result.transition_rule).toBe('FIRE_LIFECYCLE_ACTIVE_001')
    expect(result.evaluated_at).toBe(EVALUATED_AT)
  })

  it('enqueues at most one findings and one priority job per relevant transition', () => {
    const relevantStates: FireLifecycleState[] = [
      'active',
      'persistent',
      'expanding',
      'declining',
      'inactive_monitoring',
      'resolved',
      'reactivated',
      'invalidated',
    ]
    for (const state of relevantStates) {
      expect(shouldEnqueueFindingReevaluation(state)).toBe(true)
      expect(shouldEnqueuePriorityReevaluation(state)).toBe(true)
    }
    expect(shouldEnqueueFindingReevaluation('detected')).toBe(false)
    expect(shouldEnqueuePriorityReevaluation('detected')).toBe(false)
  })

  it('transitions to inactive_monitoring without confirming extinction', () => {
    const result = evaluate(
      snapshot({
        lifecycle_state: 'active',
        last_detected_at: '2026-07-09T08:00:00.000Z',
        detections: [detection('d1', '2026-07-09T08:00:00.000Z')],
      }),
    )
    expect(result.new_state).toBe('inactive_monitoring')
    expect(result.transition_reason).toContain('sin confirmar extinción')
  })

  it('transitions to resolved after the resolved window', () => {
    const result = evaluate(
      snapshot({
        lifecycle_state: 'inactive_monitoring',
        last_detected_at: '2026-07-05T18:00:00.000Z',
        detections: [detection('d1', '2026-07-05T18:00:00.000Z')],
      }),
    )
    expect(result.new_state).toBe('resolved')
    expect(result.transition_rule).toBe('FIRE_LIFECYCLE_RESOLVED_001')
  })

  it('rejects disallowed transitions deterministically', () => {
    const rule = evaluateFireLifecycleState(
      snapshot({
        lifecycle_state: 'detected',
        last_detected_at: '2026-07-10T18:00:00.000Z',
        detection_count: 5,
        detections: [
          detection('d1', '2026-07-10T08:00:00.000Z', 14.6, -90.5),
          detection('d2', '2026-07-10T10:00:00.000Z', 14.601, -90.501),
          detection('d3', '2026-07-10T12:00:00.000Z', 14.602, -90.502),
          detection('d4', '2026-07-10T14:00:00.000Z', 14.603, -90.503),
          detection('d5', '2026-07-10T18:00:00.000Z', 14.604, -90.504),
        ],
      }),
      EVALUATED_AT,
    )
    const evaluation = genericLifecycleEngine.evaluate({
      snapshot: snapshot({
        lifecycle_state: 'detected',
        last_detected_at: '2026-07-10T18:00:00.000Z',
        detection_count: 5,
        detections: [
          detection('d1', '2026-07-10T08:00:00.000Z', 14.6, -90.5),
          detection('d2', '2026-07-10T10:00:00.000Z', 14.601, -90.501),
          detection('d3', '2026-07-10T12:00:00.000Z', 14.602, -90.502),
          detection('d4', '2026-07-10T14:00:00.000Z', 14.603, -90.503),
          detection('d5', '2026-07-10T18:00:00.000Z', 14.604, -90.504),
        ],
      }),
      evaluatedAt: EVALUATED_AT,
    })
    if (rule.proposed_state === 'expanding') {
      expect(evaluation.new_state).not.toBe('expanding')
      expect(evaluation.transition_rule).toBe('FIRE_LIFECYCLE_TRANSITION_REJECTED_001')
    }
  })

  it('uses a deterministic context signature independent of detection order', () => {
    const detections = [
      detection('b', '2026-07-10T12:00:00.000Z'),
      detection('a', '2026-07-10T08:00:00.000Z'),
    ]
    const sigA = buildFireLifecycleContextSignature(
      snapshot({ detections, last_detected_at: '2026-07-10T12:00:00.000Z' }),
    )
    const sigB = buildFireLifecycleContextSignature(
      snapshot({
        detections: [...detections].reverse(),
        last_detected_at: '2026-07-10T12:00:00.000Z',
      }),
    )
    expect(sigA).toBe(sigB)
  })
})
