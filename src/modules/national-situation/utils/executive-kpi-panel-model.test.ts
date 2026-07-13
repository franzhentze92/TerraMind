import { describe, expect, it } from 'vitest'
import type { ExecutiveDashboardDto } from '@/modules/executive-demo/types/executive-demo.types'
import type { OperationalPeriodComparison } from './operational-period-comparison'
import {
  buildExecutiveKpiCardModels,
  computeTrendPercent,
  KPI_TREND_NO_COMPARISON,
} from './executive-kpi-panel-model'
import type { PrimaryKpiItem } from '../national-situation.constants'
import {
  ACTIVE_RESPONSES_PENDING_EXPLANATION,
  PRIORITY_THREATS_PENDING_EXPLANATION,
} from '../national-situation.constants'

const baseKpis: PrimaryKpiItem[] = [
  {
    id: 'fire_observations',
    label: 'Observaciones totales',
    value: 6,
    timeWindowLabel: 'Últimas 48 horas',
    isCurrentState: false,
    breakdown: [],
  },
  {
    id: 'events_active',
    label: 'Eventos activos',
    value: 18,
    timeWindowLabel: 'Estado actual',
    isCurrentState: true,
    breakdown: [],
  },
  {
    id: 'priority_threats',
    label: 'Amenazas prioritarias',
    value: 0,
    timeWindowLabel: 'Estado actual',
    isCurrentState: true,
    breakdown: [],
    unavailable: { status: 'not_implemented', explanation: PRIORITY_THREATS_PENDING_EXPLANATION },
  },
  {
    id: 'active_missions',
    label: 'Misiones activas',
    value: 0,
    timeWindowLabel: 'Estado actual',
    isCurrentState: true,
    breakdown: [],
    href: '/misiones',
  },
  {
    id: 'active_responses',
    label: 'Respuestas en marcha',
    value: 0,
    timeWindowLabel: 'Estado actual',
    isCurrentState: true,
    breakdown: [],
    unavailable: { status: 'not_implemented', explanation: ACTIVE_RESPONSES_PENDING_EXPLANATION },
  },
  {
    id: 'pending_decisions',
    label: 'Decisiones pendientes',
    value: 0,
    timeWindowLabel: 'Estado actual',
    isCurrentState: true,
    breakdown: [],
    href: '/respuesta',
  },
]

function comparison(overrides: Partial<OperationalPeriodComparison['metrics']> = {}): OperationalPeriodComparison {
  const zero = { current: 0, previous: 0 }
  return {
    period_hours: 48,
    as_of: new Date().toISOString(),
    metrics: {
      verifications: zero,
      missions: zero,
      evidence: zero,
      decisions: zero,
      responses: zero,
      ...overrides,
    },
  }
}

describe('buildExecutiveKpiCardModels', () => {
  it('maps executive subtitles, tooltips and formats headline values', () => {
    const cards = buildExecutiveKpiCardModels({
      primaryKpis: baseKpis,
      periodHours: 48,
      dashboard: undefined,
    })

    expect(cards).toHaveLength(6)
    expect(cards.map((c) => c.id)).toEqual([
      'fire_observations',
      'events_active',
      'priority_threats',
      'active_missions',
      'active_responses',
      'pending_decisions',
    ])
    expect(cards[0]?.subtitle).toBe('Últimas 48 horas')
    expect(cards[1]?.subtitle).toBe('En seguimiento')
    expect(cards[3]?.subtitle).toBe('Aprobadas, asignadas o en ejecución')
    expect(cards[5]?.tooltip).toMatch(/revisión|aprobación/i)
  })

  it('renders responses as an unavailable placeholder (—), never a confirmed 0', () => {
    const cards = buildExecutiveKpiCardModels({
      primaryKpis: baseKpis,
      periodHours: 48,
      dashboard: undefined,
    })
    const responses = cards.find((c) => c.id === 'active_responses')
    expect(responses?.isUnavailable).toBe(true)
    expect(responses?.value).toBeNull()
    expect(responses?.formattedValue).toBe('—')
    expect(responses?.showTrend).toBe(false)
    expect(responses?.subtitle).toBe('Seguimiento de respuestas pendiente')
  })

  it('renders the threat KPI as an unavailable placeholder', () => {
    const cards = buildExecutiveKpiCardModels({
      primaryKpis: baseKpis,
      periodHours: 48,
      dashboard: undefined,
    })
    const threats = cards.find((c) => c.id === 'priority_threats')
    expect(threats?.isUnavailable).toBe(true)
    expect(threats?.value).toBeNull()
    expect(threats?.formattedValue).toBe('—')
    expect(threats?.showTrend).toBe(false)
    expect(threats?.subtitle).toBe('Motor de amenazas pendiente')
    expect(threats?.tooltip).toBe(PRIORITY_THREATS_PENDING_EXPLANATION)
  })

  it('shows "Sin periodo comparable" when there is no comparable window', () => {
    const cards = buildExecutiveKpiCardModels({
      primaryKpis: baseKpis,
      periodHours: 48,
      dashboard: undefined,
    })
    const events = cards.find((c) => c.id === 'events_active')
    const decisions = cards.find((c) => c.id === 'pending_decisions')
    expect(events?.trendLabel).toBe(KPI_TREND_NO_COMPARISON)
    // No operational comparison → decisions has no defensible comparison.
    expect(decisions?.trendLabel).toBe(KPI_TREND_NO_COMPARISON)
  })

  it('uses the operational comparison for mission and decision trends', () => {
    const dashboard = {
      recent_changes: [],
      operational_period_comparison: comparison({
        missions: { current: 6, previous: 4 },
        decisions: { current: 2, previous: 5 },
      }),
    } as unknown as ExecutiveDashboardDto

    const cards = buildExecutiveKpiCardModels({
      primaryKpis: baseKpis,
      periodHours: 48,
      dashboard,
    })

    const missions = cards.find((c) => c.id === 'active_missions')
    const decisions = cards.find((c) => c.id === 'pending_decisions')
    expect(missions?.trendLabel).toContain('50%')
    expect(missions?.trendDirection).toBe('up')
    expect(decisions?.trendLabel).toContain('60%')
    expect(decisions?.trendDirection).toBe('down')
  })

  it('preserves 0 as a valid comparison (→ 0%)', () => {
    const dashboard = {
      recent_changes: [],
      operational_period_comparison: comparison({
        missions: { current: 3, previous: 3 },
      }),
    } as unknown as ExecutiveDashboardDto

    const cards = buildExecutiveKpiCardModels({ primaryKpis: baseKpis, periodHours: 48, dashboard })
    const missions = cards.find((c) => c.id === 'active_missions')
    expect(missions?.trendLabel).toContain('0%')
    expect(missions?.trendDirection).toBe('flat')
  })
})

describe('computeTrendPercent', () => {
  it('rounds percentage change', () => {
    expect(computeTrendPercent(187, 153)).toBe(22)
    expect(computeTrendPercent(27, 30)).toBe(-10)
  })

  it('returns null when there is no comparable base', () => {
    expect(computeTrendPercent(5, 0)).toBeNull()
  })
})
