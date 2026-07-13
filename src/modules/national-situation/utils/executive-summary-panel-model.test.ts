import { describe, expect, it } from 'vitest'
import type { ExecutiveDashboardDto } from '@/modules/executive-demo/types/executive-demo.types'
import { buildNationalExecutiveSummary } from '../national-executive-summary'
import {
  buildExecutiveSummaryPanelModel,
  EXEC_SUMMARY_PENDING,
} from './executive-summary-panel-model'

const baseSummary = buildNationalExecutiveSummary([], undefined, 48)

function row(id: string, model: ReturnType<typeof buildExecutiveSummaryPanelModel>) {
  const found = model.rows.find((r) => r.id === id)
  if (!found) throw new Error(`missing row ${id}`)
  return found
}

describe('buildExecutiveSummaryPanelModel', () => {
  it('builds the five reference rows with real event counts and pending economics', () => {
    const model = buildExecutiveSummaryPanelModel({
      types: [
        {
          type: 'rainfall_deficit',
          label: 'Déficit de precipitación',
          pluralLabel: 'Déficits de precipitación',
          icon: 'cloud-rain',
          accentColor: '#f59e0b',
          activeCount: 63,
          newCount: 14,
        },
        {
          type: 'thermal_activity',
          label: 'Actividad térmica',
          pluralLabel: 'Eventos térmicos',
          icon: 'flame',
          accentColor: '#f97316',
          activeCount: 82,
          newCount: 8,
        },
      ],
      totalActive: 145,
      periodHours: 48,
      summary: baseSummary,
      metrics: [],
      dashboard: undefined,
    })

    expect(model.rows).toHaveLength(5)

    const happening = row('what_is_happening', model)
    expect(happening.kind).toBe('prose')
    if (happening.kind === 'prose') {
      expect(happening.content).toContain('145')
      expect(happening.content).toContain('déficit de precipitación')
    }

    const changed = row('what_changed', model)
    if (changed.kind === 'prose') {
      expect(changed.content).toContain('vs. 48h anteriores')
      expect(changed.content).toContain('déficit de precipitación')
    }

    const economic = row('economic_risk', model)
    expect(economic.kind).toBe('metric')
    if (economic.kind === 'metric') {
      expect(economic.metricValue).toBe(EXEC_SUMMARY_PENDING)
    }

    const inaction = row('inaction_cost', model)
    if (inaction.kind === 'metric') {
      expect(inaction.metricValue).toBe(EXEC_SUMMARY_PENDING)
    }
  })

  it('formats economic values when dashboard metadata is present', () => {
    const dashboard = {
      metadata: {
        productiveValueGtq: 3_280_000_000,
        potentialLossGtq: 520_000_000,
      },
    } as unknown as ExecutiveDashboardDto

    const model = buildExecutiveSummaryPanelModel({
      types: [],
      totalActive: 0,
      periodHours: 48,
      summary: baseSummary,
      metrics: [{ id: 'verification_needs_active', value: 2 } as never],
      dashboard,
    })

    const economic = row('economic_risk', model)
    const inaction = row('inaction_cost', model)
    if (economic.kind === 'metric' && inaction.kind === 'metric') {
      expect(economic.metricValue).toMatch(/Q 3[.,]280 millones/)
      expect(inaction.metricValue).toMatch(/Q 520 millones/)
    }

    const recommendation = row('terramind_recommends', model)
    if (recommendation.kind === 'prose') {
      expect(recommendation.content).toContain('Verificar en campo')
    }
  })
})
