import { describe, expect, it } from 'vitest'
import type { ExecutiveDashboardDto } from '@/modules/executive-demo/types/executive-demo.types'
import type { ExecutiveMetric } from '@/modules/executive-metrics/executive-metric.types'
import {
  PRIMARY_KPI_LIMIT,
  buildPrimaryKpis,
  filterEntriesByPeriod,
  CURRENT_STATE_METRIC_IDS,
  SITUATION_TABS,
} from './national-situation.constants'
import { buildNationalExecutiveSummary } from './national-executive-summary'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function syntheticMetrics(): ExecutiveMetric[] {
  return [
    {
      id: 'fire_observations',
      label: 'Observaciones recibidas',
      value: 97,
      scope: 'national',
      classification: 'operational',
      timeWindow: { key: '48h', label: 'Últimas 48 horas' },
      breakdown: [{ label: 'Operacional', value: 97, included: true, classification: 'operational' }],
      source: 'fire_ingestion_runs',
      limitations: [],
    },
    {
      id: 'fire_detections_national',
      label: 'Detecciones nacionales',
      value: 38,
      scope: 'national',
      classification: 'operational',
      timeWindow: { key: '48h', label: 'Últimas 48 horas' },
      breakdown: [{ label: 'Operacional', value: 38, included: true, classification: 'operational' }],
      source: 'fire_detections',
      limitations: [],
    },
    {
      id: 'fire_events',
      label: 'Eventos térmicos agrupados',
      value: 14,
      scope: 'national',
      classification: 'operational',
      timeWindow: { key: '48h', label: 'Últimas 48 horas' },
      breakdown: [{ label: 'Operacional', value: 14, included: true, classification: 'operational' }],
      source: 'fire_events',
      limitations: [],
    },
    {
      id: 'findings_active',
      label: 'Hallazgos activos',
      value: 50,
      scope: 'national',
      classification: 'operational',
      timeWindow: { key: 'all_time', label: 'Estado actual' },
      breakdown: [{ label: 'Operacional', value: 50, included: true, classification: 'operational' }],
      source: 'findings',
      limitations: [],
    },
    {
      id: 'incidents_operational',
      label: 'Incidentes operacionales',
      value: 0,
      scope: 'organization',
      classification: 'operational',
      timeWindow: { key: 'all_time', label: 'Estado actual' },
      breakdown: [
        { label: 'Operacional', value: 0, included: true, classification: 'operational' },
        {
          label: 'Legacy pendientes',
          value: 4,
          included: false,
          classification: 'legacy',
          reason: 'legacy_unowned',
        },
      ],
      source: 'incidents',
      limitations: [],
    },
  ]
}

function baseDashboard(overrides: Partial<ExecutiveDashboardDto> = {}): ExecutiveDashboardDto {
  return {
    generated_at: new Date().toISOString(),
    system_status: 'operational',
    last_sync_at: null,
    sources_active: 1,
    include_demo: false,
    metrics: [],
    summary: {} as ExecutiveDashboardDto['summary'],
    priority_findings: [],
    active_incidents: [],
    recent_changes: [],
    pending_verifications: [],
    missions_in_progress: [],
    recent_evidence: [],
    recent_resolutions: [],
    response_recommendations: [],
    pending_decisions: [],
    empty_sections: [],
    data_audit: [],
    recommended_demo_incident_id: null,
    ...overrides,
  }
}

describe('national situation constants', () => {
  it('exposes exactly six primary KPIs', () => {
    const kpis = buildPrimaryKpis(syntheticMetrics(), 2)
    expect(kpis).toHaveLength(PRIMARY_KPI_LIMIT)
    expect(kpis[5].label).toBe('Decisiones pendientes')
    expect(kpis[5].value).toBe(2)
  })

  it('shows legacy breakdown without counting as operational', () => {
    const inc = buildPrimaryKpis(syntheticMetrics(), 0).find((k) => k.id === 'incidents_operational')
    expect(inc?.value).toBe(0)
    expect(inc?.secondary).toMatch(/legacy/)
  })

  it('labels current-state metrics', () => {
    const findings = buildPrimaryKpis(syntheticMetrics(), 0).find((k) => k.id === 'findings_active')
    expect(findings?.timeWindowLabel).toBe('Estado actual')
    expect(CURRENT_STATE_METRIC_IDS.has('findings_active')).toBe(true)
  })

  it('defines five situation tabs', () => {
    expect(SITUATION_TABS.map((t) => t.id)).toEqual([
      'panorama',
      'actividad',
      'verificacion',
      'operaciones',
      'timeline',
    ])
  })
})

describe('national executive summary', () => {
  it('does not invent formal recommendation without assessment', () => {
    const s = buildNationalExecutiveSummary(syntheticMetrics(), baseDashboard())
    expect(s.terramind_recommends).toContain('Aún no existe una recomendación operacional formal')
    expect(s.terramind_recommends.toLowerCase()).not.toContain('downstream')
    expect(s.terramind_recommends.toLowerCase()).not.toContain('response assessment')
  })

  it('uses real delta when recent changes exist in period', () => {
    const now = Date.now()
    const s = buildNationalExecutiveSummary(
      syntheticMetrics(),
      baseDashboard({
        recent_changes: [
          {
            id: '1',
            timestamp: new Date(now - 3600_000).toISOString(),
            stage: 'event',
            stage_label: 'Evento',
            status: 'ok',
            source: 'fires',
            confidence: 'medium',
            summary: 'Cambio de prueba',
            epistemic: 'observed',
          },
        ],
      }),
      48,
    )
    expect(s.what_changed).toMatch(/1 cambio/)
  })

  it('states insufficient history when no changes', () => {
    const s = buildNationalExecutiveSummary(syntheticMetrics(), baseDashboard(), 48)
    expect(s.what_changed).toContain('No hay una comparación histórica suficiente')
  })
})

describe('period filtering', () => {
  it('filters timeline entries by period hours', () => {
    const now = Date.now()
    const entries = [
      { timestamp: new Date(now - 2 * 3600_000).toISOString() },
      { timestamp: new Date(now - 100 * 3600_000).toISOString() },
    ]
    const filtered = filterEntriesByPeriod(entries, 24, now)
    expect(filtered).toHaveLength(1)
  })
})

describe('page structure', () => {
  it('overview page uses provider and avoids legacy stack', () => {
    const page = readFileSync(
      resolve(process.cwd(), 'src/modules/national-center/pages/NationalSituationPage.tsx'),
      'utf8',
    )
    expect(page).toContain('NationalSituationProvider')
    expect(page).toContain('ExecutiveOverview')
    expect(page).not.toContain('SourcesFooter')
    expect(page).not.toContain('CountryIndicatorsPanel')
  })

  it('kpi grid has responsive layout classes', () => {
    const grid = readFileSync(
      resolve(process.cwd(), 'src/modules/national-situation/components/ExecutiveKpiGrid.tsx'),
      'utf8',
    )
    expect(grid).toContain('sm:grid-cols-2')
    expect(grid).toContain('xl:grid-cols-6')
  })

  it('tabs lazy-load panels', () => {
    const tabs = readFileSync(
      resolve(process.cwd(), 'src/modules/national-situation/components/SituationTabs.tsx'),
      'utf8',
    )
    expect(tabs).toContain('lazy(')
    expect(tabs).toContain('Suspense')
  })
})

describe('demo separation', () => {
  it('does not include demo in operational incident headline', () => {
    const metrics: ExecutiveMetric[] = [
      {
        id: 'incidents_operational',
        label: 'Incidentes operacionales',
        value: 0,
        scope: 'organization',
        classification: 'operational',
        timeWindow: { key: 'all_time', label: 'Estado actual' },
        breakdown: [
          { label: 'Operacional', value: 0, included: true, classification: 'operational' },
          { label: 'Demo', value: 3, included: false, classification: 'demo', reason: 'demo_excluded' },
        ],
        source: 'incidents',
        limitations: [],
      },
    ]
    const inc = buildPrimaryKpis(metrics, 0).find((k) => k.id === 'incidents_operational')
    expect(inc?.value).toBe(0)
  })
})
