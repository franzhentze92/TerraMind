import { describe, expect, it } from 'vitest'

import {
  buildDataQualityFromContext,
  buildExecutiveMetricsFromContext,
  type ResolvedContext,
} from './executive-metrics.service.js'
import { reportMetricValue } from './reports.service.js'
import { isRegisteredMetric } from '@/modules/executive-metrics/metric-registry'

/** Context reproducing the exact contradictions the spec calls out. */
function baseContext(overrides: Partial<ResolvedContext> = {}): ResolvedContext {
  return {
    fire: {
      observations_downloaded: 97,
      detections_count: 38,
      events_count: 14,
      attention_events_count: 3,
      window_start_utc: '2026-07-08T00:00:00.000Z',
      window_end_utc: '2026-07-10T00:00:00.000Z',
      generated_at: '2026-07-10T00:00:00.000Z',
    },
    incidents: { operational: 0, legacy: 4, demo: 1, outOfScope: 0 },
    missions: { operational: 0, legacy: 0, demo: 2, outOfScope: 0 },
    evidence: { operational: 0, legacy: 0, demo: 1, outOfScope: 0 },
    findingsActive: 50,
    findingsMonitoring: 5,
    findingsResolved: 2,
    findingsTotal: 57,
    priorities: 12,
    verificationPlansLegacy: 4,
    verificationNeedsActive: 0,
    responseAssessments: 0,
    sourcesActive: 1,
    lastSyncAt: '2026-07-10T00:00:00.000Z',
    ...overrides,
  }
}

function metric(ctx: ResolvedContext, id: string, includeDemo = false) {
  const m = buildExecutiveMetricsFromContext(ctx, { include_demo: includeDemo }).find((x) => x.id === id)
  if (!m) throw new Error(`metric ${id} not produced`)
  return m
}

describe('ExecutiveMetricsService — fire funnel', () => {
  it('raw observations differ from national detections and events', () => {
    const ctx = baseContext()
    expect(metric(ctx, 'fire_observations').value).toBe(97)
    expect(metric(ctx, 'fire_detections_national').value).toBe(38)
    expect(metric(ctx, 'fire_events').value).toBe(14)
    // They are three distinct measures, never conflated.
    expect(metric(ctx, 'fire_observations').value).not.toBe(
      metric(ctx, 'fire_detections_national').value,
    )
  })

  it('national detections roll up into events (detections >= events)', () => {
    const ctx = baseContext()
    expect(metric(ctx, 'fire_detections_national').value).toBeGreaterThanOrEqual(
      metric(ctx, 'fire_events').value,
    )
  })

  it('fire metrics declare the 48h window label', () => {
    expect(metric(baseContext(), 'fire_observations').timeWindow.label).toBe('Últimas 48 horas')
  })
})

describe('ExecutiveMetricsService — incidents', () => {
  it('operational = 0 and legacy = 4 shown separately', () => {
    const m = metric(baseContext(), 'incidents_operational')
    expect(m.value).toBe(0)
    const legacy = m.breakdown.find((b) => b.classification === 'legacy')
    expect(legacy?.value).toBe(4)
    expect(legacy?.included).toBe(false)
  })

  it('legacy is excluded from the operational KPI value', () => {
    const m = metric(baseContext(), 'incidents_operational')
    const includedTotal = m.breakdown.filter((b) => b.included).reduce((a, b) => a + b.value, 0)
    expect(includedTotal).toBe(m.value)
  })
})

describe('ExecutiveMetricsService — missions & evidence demo policy', () => {
  it('missions operational = 0, demo = 2', () => {
    const m = metric(baseContext(), 'missions_operational')
    expect(m.value).toBe(0)
    expect(m.breakdown.find((b) => b.classification === 'demo')?.value).toBe(2)
  })

  it('evidence operational = 0, demo = 1', () => {
    const m = metric(baseContext(), 'evidence_operational')
    expect(m.value).toBe(0)
    expect(m.breakdown.find((b) => b.classification === 'demo')?.value).toBe(1)
  })

  it('demo is excluded from operational value by default', () => {
    const m = metric(baseContext(), 'missions_operational', false)
    const demo = m.breakdown.find((b) => b.classification === 'demo')
    expect(demo?.included).toBe(false)
  })

  it('include_demo does NOT mutate the operational count', () => {
    const withoutDemo = metric(baseContext(), 'missions_operational', false).value
    const withDemo = metric(baseContext(), 'missions_operational', true).value
    expect(withDemo).toBe(withoutDemo)
    expect(withDemo).toBe(0)
  })
})

describe('ExecutiveMetricsService — verification & response', () => {
  it('legacy plans = 4 but active needs = 0', () => {
    const ctx = baseContext()
    expect(metric(ctx, 'verification_plans_legacy').value).toBe(4)
    expect(metric(ctx, 'verification_needs_active').value).toBe(0)
  })

  it('response assessments = 0', () => {
    expect(metric(baseContext(), 'response_assessments').value).toBe(0)
  })
})

describe('ExecutiveMetricsService — invariants', () => {
  it('every emitted metric is registered', () => {
    for (const m of buildExecutiveMetricsFromContext(baseContext())) {
      expect(isRegisteredMetric(m.id)).toBe(true)
    }
  })

  it('every metric declares a time window and a non-empty breakdown', () => {
    for (const m of buildExecutiveMetricsFromContext(baseContext())) {
      expect(m.timeWindow.label.length).toBeGreaterThan(0)
      expect(m.breakdown.length).toBeGreaterThan(0)
      expect(m.source.length).toBeGreaterThan(0)
    }
  })

  it('every metric carries a source (documented provenance)', () => {
    for (const m of buildExecutiveMetricsFromContext(baseContext())) {
      expect(m.source).toBeTruthy()
    }
  })

  it('same filters produce the same numbers (determinism → dashboard == report)', () => {
    const ctx = baseContext()
    const a = buildExecutiveMetricsFromContext(ctx, { include_demo: false })
    const b = buildExecutiveMetricsFromContext(ctx, { include_demo: false })
    expect(a.map((m) => [m.id, m.value])).toEqual(b.map((m) => [m.id, m.value]))
  })

  it('dashboard metric == report metric for every KPI the report prints (§12)', () => {
    const ctx = baseContext()
    // The dashboard panel consumes exactly this array (getExecutiveMetrics).
    const dashboardMetrics = buildExecutiveMetricsFromContext(ctx, { include_demo: false })
    // Every id the national report renders via reportMetricValue().
    const reportKpiIds = [
      'sources_active',
      'findings_active',
      'incidents_operational',
      'verification_plans_legacy',
      'verification_needs_active',
      'missions_operational',
      'evidence_operational',
      'response_assessments',
    ]
    for (const id of reportKpiIds) {
      const dashboardValue = dashboardMetrics.find((m) => m.id === id)?.value ?? 0
      const reportValue = reportMetricValue(dashboardMetrics, id)
      expect(reportValue, `report/dashboard divergence for ${id}`).toBe(dashboardValue)
    }
    // Enabling demo must not change any operational value the report prints.
    const withDemo = buildExecutiveMetricsFromContext(ctx, { include_demo: true })
    for (const id of reportKpiIds) {
      expect(reportMetricValue(withDemo, id)).toBe(reportMetricValue(dashboardMetrics, id))
    }
  })

  it('zero-state context produces valid zero metrics', () => {
    const ctx = baseContext({
      incidents: { operational: 0, legacy: 0, demo: 0, outOfScope: 0 },
      missions: { operational: 0, legacy: 0, demo: 0, outOfScope: 0 },
      evidence: { operational: 0, legacy: 0, demo: 0, outOfScope: 0 },
      findingsActive: 0,
      priorities: 0,
      verificationPlansLegacy: 0,
    })
    const metrics = buildExecutiveMetricsFromContext(ctx)
    expect(metrics.every((m) => m.value >= 0)).toBe(true)
  })
})

describe('ExecutiveMetricsService — data quality summary', () => {
  it('aggregates operational / legacy / demo / pending records', () => {
    const dq = buildDataQualityFromContext(baseContext(), Date.parse('2026-07-10T00:05:00.000Z'))
    expect(dq.legacyRecords).toBeGreaterThan(0)
    expect(dq.demoRecords).toBe(4) // incidents 1 + missions 2 + evidence 1
    expect(dq.unresolvedOwnershipRecords).toBe(4) // incidents legacy 4
    expect(dq.freshnessStatus).toBe('fresh')
    expect(dq.warnings.length).toBeGreaterThan(0)
  })

  it('marks stale data when the last update is old', () => {
    const dq = buildDataQualityFromContext(baseContext(), Date.parse('2026-07-12T00:00:00.000Z'))
    expect(dq.freshnessStatus).toBe('stale')
  })
})
