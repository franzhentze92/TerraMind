import { describe, expect, it } from 'vitest'
import type { ExecutiveDashboardDto } from '@/modules/executive-demo/types/executive-demo.types'
import type { ExecutiveMetric } from '@/modules/executive-metrics/executive-metric.types'
import {
  PRIMARY_KPI_LIMIT,
  buildPrimaryKpis,
  countActiveMissions,
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
    top_priorities: [],
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

function buildKpis(overrides: Partial<Parameters<typeof buildPrimaryKpis>[0]> = {}) {
  return buildPrimaryKpis({
    metrics: syntheticMetrics(),
    eventsActive: 9,
    activeMissions: 4,
    activeResponses: 0,
    pendingDecisions: 2,
    ...overrides,
  })
}

describe('national situation constants', () => {
  it('exposes TerramMind visible KPI row in order', () => {
    const kpis = buildKpis()
    expect(kpis).toHaveLength(PRIMARY_KPI_LIMIT)
    expect(kpis.map((k) => k.id)).toEqual([
      'fire_observations',
      'events_active',
      'priority_threats',
      'active_missions',
      'active_responses',
      'pending_decisions',
    ])
    // Detectamos → interpretamos → asignamos → respondemos.
    expect(kpis.map((k) => k.label)).toEqual([
      'Observaciones totales',
      'Eventos activos',
      'Amenazas prioritarias',
      'Misiones activas',
      'Respuestas en marcha',
      'Decisiones pendientes',
    ])
    expect(kpis[1].value).toBe(9)
    expect(kpis[3].value).toBe(4)
    expect(kpis[5].value).toBe(2)
  })

  it('removes hallazgos and incidentes from the executive row', () => {
    const kpis = buildKpis()
    expect(kpis.find((k) => k.id === 'findings_active')).toBeUndefined()
    expect(kpis.find((k) => k.id === 'incidents_operational')).toBeUndefined()
  })

  it('never turns findings or priorities into threats (unavailable until engine)', () => {
    // 50 findings + 12 priorities in the synthetic context must NOT leak into
    // the threat KPI value.
    const threats = buildKpis().find((k) => k.id === 'priority_threats')
    expect(threats?.unavailable?.status).toBe('not_implemented')
    expect(threats?.value).toBe(0)
    expect(threats?.unavailable?.explanation).toMatch(/evidencia|impacto|prioridad/i)
  })

  it('does not surface thermal-specific measures as national KPIs', () => {
    const kpis = buildKpis()
    expect(kpis.find((k) => k.id === 'fire_detections_national')).toBeUndefined()
    expect(kpis.find((k) => k.id === 'fire_events')).toBeUndefined()
  })

  it('counts only assigned/in-execution missions, excluding demo & terminal', () => {
    const missions = [
      { status: 'assigned', is_internal_demo: false },
      { status: 'in_progress', is_internal_demo: false },
      { status: 'blocked', is_internal_demo: false },
      { status: 'completed', is_internal_demo: false },
      { status: 'cancelled', is_internal_demo: false },
      { status: 'draft', is_internal_demo: false },
      { status: 'in_progress', is_internal_demo: true },
    ]
    expect(countActiveMissions(missions, false)).toBe(3)
    expect(countActiveMissions(missions, true)).toBe(4)
  })

  it('marks responses unavailable until a canonical active-response source', () => {
    // Even if a caller passes a number, responses stay unavailable (never a
    // confirmed 0) until a canonical source is wired.
    const responses = buildKpis({ activeResponses: 5 }).find((k) => k.id === 'active_responses')
    expect(responses?.unavailable?.status).toBe('not_implemented')
    expect(responses?.unavailable?.explanation).toMatch(/planes o acciones de respuesta/i)
  })

  it('labels current-state metrics', () => {
    const missions = buildKpis().find((k) => k.id === 'active_missions')
    expect(missions?.timeWindowLabel).toBe('Estado actual')
    expect(CURRENT_STATE_METRIC_IDS.has('active_missions')).toBe(true)
    expect(CURRENT_STATE_METRIC_IDS.has('pending_decisions')).toBe(true)
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
    expect(s.what_changed).toMatch(/1 evento nuevo/)
    expect(s.what_changed).toContain('Durante las últimas 48 horas')
  })

  it('states insufficient history when no changes', () => {
    const s = buildNationalExecutiveSummary(syntheticMetrics(), baseDashboard(), 48)
    expect(s.what_changed).toContain('No hay suficiente historial comparable')
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

describe('final visual parity polish — layout & compaction', () => {
  const comp = (name: string) =>
    readFileSync(
      resolve(process.cwd(), `src/modules/national-situation/components/${name}`),
      'utf8',
    )

  it('overview mounts auto-selection and uses stretch bands with 22/54/24 proportions', () => {
    const overview = comp('ExecutiveOverview.tsx')
    expect(overview).toContain('AutoEventSelection')
    expect(overview).toContain('items-stretch')
    expect(overview).toContain('space-y-3')
    // Map dominant: middle column ~2.4fr against 1fr side panels.
    expect(overview).toContain('minmax(0,2.4fr)')
    expect(overview).toContain('minmax(0,1fr)')
  })

  it('map fits bounds to active events (not a fixed wide extent)', () => {
    const map = comp('NationalEventMap.tsx')
    expect(map).toContain('combineBounds')
    expect(map).toContain('boundsFromFeatureCollection')
    expect(map).toContain('FitController')
    expect(map).toContain('fitBounds')
  })

  it('event-type breakdown has compact single- and multi-type rendering', () => {
    const breakdown = comp('EventTypeBreakdown.tsx')
    expect(breakdown).toContain('event-type-breakdown-single')
    expect(breakdown).toContain('types.length === 1')
  })

  it('operational status keeps five metrics in a single compact row', () => {
    const ops = comp('OperationalStatusPanel.tsx')
    expect(ops).toContain('grid-cols-5')
  })

  it('intelligence timeline caps at five deterministic milestones', () => {
    const tl = comp('IntelligenceTimeline.tsx')
    expect(tl).toContain('MAX_ITEMS = 5')
    expect(tl).toContain('timelineEntryTitle')
  })

  it('priority findings render as compact rows (no tall two-column cards)', () => {
    const findings = comp('TopFindings.tsx')
    expect(findings).toContain('Ver todos los hallazgos')
    expect(findings).not.toContain('grid-cols-2 gap-x-2')
  })

  it('health header is a single compact message, not four separate badges', () => {
    const header = comp('SituationOperationalHeader.tsx')
    expect(header).toContain('situation-health')
    expect(header).toContain('Sincronizado')
    expect(header).not.toContain('Frescura:')
    expect(header).not.toContain('Última sincronización:')
  })
})

describe('demo separation', () => {
  it('excludes demo missions from the active-missions count', () => {
    const missions = [
      { status: 'in_progress', is_internal_demo: true },
      { status: 'in_progress', is_internal_demo: true },
      { status: 'assigned', is_internal_demo: false },
    ]
    expect(countActiveMissions(missions, false)).toBe(1)
  })
})
