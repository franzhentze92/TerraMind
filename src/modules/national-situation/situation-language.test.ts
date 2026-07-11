import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ExecutiveDashboardDto } from '@/modules/executive-demo/types/executive-demo.types'
import type { ExecutiveMetric } from '@/modules/executive-metrics/executive-metric.types'
import { buildNationalExecutiveSummary } from './national-executive-summary'
import {
  buildSituationMethodologyPresentation,
  METHODOLOGY_FORBIDDEN_MAIN_TOKENS,
  methodologyMainPanelText,
} from './utils/methodology-presentation'
import { SITUATION_TABS, buildPrimaryKpis } from './national-situation.constants'
import {
  decisionStatusLabel,
  epistemicLabel,
  evidenceSubmissionStatusLabel,
  findingTypeReason,
  periodWindowPhrase,
  resolveSystemHealth,
  situationClassificationLabel,
  spellCount,
  timelineStageLabel,
} from './utils/situation-labels'

const ROOT = process.cwd()
function read(rel: string): string {
  return readFileSync(resolve(ROOT, `src/modules/national-situation/${rel}`), 'utf8')
}
function readAbs(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8')
}

/** English registry tokens must not appear as standalone words in the main methodology panel. */
function mainPanelHasForbiddenToken(text: string, token: string): boolean {
  const patterns: Record<string, RegExp> = {
    current_state: /\bcurrent_state\b/i,
    'status = active': /\bstatus\s*=\s*'?active'?\b/i,
    time_window: /\btime_window\b/i,
    operational: /\boperational\b/i,
    legacy: /\blegacy\b/i,
    demo: /\bdemo\b/i,
    composite_findings: /\bcomposite_findings\b/i,
    tenant_owned: /\btenant_owned\b/i,
    global_public_data: /\bglobal_public_data\b/i,
  }
  const re = patterns[token]
  return re ? re.test(text) : text.toLowerCase().includes(token.toLowerCase())
}

function metrics(): ExecutiveMetric[] {
  return [
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
      id: 'verification_plans_legacy',
      label: 'Planes históricos',
      value: 4,
      scope: 'national',
      classification: 'legacy',
      timeWindow: { key: 'all_time', label: 'Estado actual' },
      breakdown: [],
      source: 'verification_plans',
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
        { label: 'Legacy', value: 3, included: false, classification: 'legacy', reason: 'ownership_unresolved' },
      ],
      source: 'incidents',
      limitations: [],
    },
  ]
}

function dashboard(overrides: Partial<ExecutiveDashboardDto> = {}): ExecutiveDashboardDto {
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

const ENGLISH_TERMS = /\b(legacy|ownership|pipeline|informational|attention|timeline|demo)\b/i

describe('situation presentation labels', () => {
  it('translates epistemic + stage tokens to Spanish', () => {
    expect(epistemicLabel('observed')).toBe('Observado')
    expect(epistemicLabel('inferred')).toBe('Inferido')
    expect(timelineStageLabel('finding')).toBe('Hallazgo')
    expect(timelineStageLabel('mission')).toBe('Misión')
  })

  it('translates record classification without English', () => {
    expect(situationClassificationLabel('legacy')).toBe('Registro histórico')
    expect(situationClassificationLabel('demo')).toBe('Demostración')
    expect(situationClassificationLabel('operational')).toBe('Operacional')
  })

  it('translates evidence + decision statuses', () => {
    expect(evidenceSubmissionStatusLabel('accepted')).toBe('Aceptada')
    expect(decisionStatusLabel('pending_approval')).toBe('Pendiente de aprobación')
  })

  it('spells small counts and names periods', () => {
    expect(spellCount(4)).toBe('cuatro')
    expect(spellCount(3)).toBe('tres')
    expect(periodWindowPhrase(48)).toBe('las últimas 48 horas')
    expect(periodWindowPhrase(24)).toBe('las últimas 24 horas')
  })
})

describe('system health is honest', () => {
  it('does not claim full health from a single recent process', () => {
    expect(resolveSystemHealth('operational', undefined).label).toBe('Sistema disponible')
  })
  it('reports delays and incidents', () => {
    expect(resolveSystemHealth('operational', 'stale').label).toBe('Datos retrasados')
    expect(resolveSystemHealth('operational', 'delayed').label).toBe('Datos parcialmente actualizados')
    expect(resolveSystemHealth('degraded', 'fresh').label).toBe('Sistema con incidencias')
  })
  it('reserves full-health label for all sources fresh', () => {
    expect(resolveSystemHealth('operational', 'fresh').label).toBe('Todos los procesos actualizados')
  })
})

describe('finding reason is specific or hidden', () => {
  it('maps known finding types to specific reasons', () => {
    expect(findingTypeReason('thermal_activity_in_mixed_natural_cover')).toMatch(/cobertura natural/)
    expect(findingTypeReason('nearby_population_with_reliable_estimate')).toMatch(/Población/)
  })
  it('returns null when unknown so the line is hidden', () => {
    expect(findingTypeReason('unknown_type')).toBeNull()
  })
})

describe('executive summary language + pluralization', () => {
  it('uses natural Spanish without internal terms', () => {
    const s = buildNationalExecutiveSummary(metrics(), dashboard({ include_demo: false }), 48)
    const all = Object.values(s).join(' \n ')
    expect(all).not.toMatch(ENGLISH_TERMS)
    expect(all).not.toContain('(s)')
    expect(all).not.toContain('(operacional)')
  })

  it('fixes plurals for events and findings', () => {
    const s = buildNationalExecutiveSummary(metrics(), dashboard(), 48)
    expect(s.what_is_happening).toContain('14 eventos térmicos agrupados')
    expect(s.what_is_happening).toContain('50 hallazgos activos')
  })

  it('describes historical plans and incidents naturally', () => {
    const s = buildNationalExecutiveSummary(metrics(), dashboard(), 48)
    expect(s.in_verification).toContain('No hay verificaciones operativas activas')
    expect(s.in_verification).toContain('cuatro planes históricos')
    expect(s.in_verification).toContain('tres incidentes pendientes de asignación organizacional')
  })

  it('computes real deltas or an explicit fallback', () => {
    const now = Date.now()
    const withChanges = buildNationalExecutiveSummary(
      metrics(),
      dashboard({
        recent_changes: [
          { id: 'e1', timestamp: new Date(now - 3600_000).toISOString(), stage: 'event', stage_label: 'Evento', status: 'ok', source: 'x', confidence: 'medium', summary: 'x', epistemic: 'observed' },
          { id: 'e2', timestamp: new Date(now - 3600_000).toISOString(), stage: 'event', stage_label: 'Evento', status: 'ok', source: 'x', confidence: 'medium', summary: 'x', epistemic: 'observed' },
          { id: 'f1', timestamp: new Date(now - 3600_000).toISOString(), stage: 'finding', stage_label: 'Hallazgo', status: 'ok', source: 'x', confidence: 'medium', summary: 'x', epistemic: 'inferred' },
        ],
      }),
      48,
    )
    expect(withChanges.what_changed).toContain('2 eventos nuevos')
    expect(withChanges.what_changed).toContain('1 hallazgo nuevo')
    const empty = buildNationalExecutiveSummary(metrics(), dashboard(), 48)
    expect(empty.what_changed).toContain('No hay suficiente historial comparable')
  })
})

describe('primary KPI secondary line', () => {
  it('describes historical records without English', () => {
    const inc = buildPrimaryKpis(metrics(), 0).find((k) => k.id === 'incidents_operational')
    expect(inc?.secondary).toContain('registros históricos')
    expect(inc?.secondary).not.toMatch(ENGLISH_TERMS)
  })
})

describe('cronología tab renamed', () => {
  it('uses Cronología instead of Timeline', () => {
    const timelineTab = SITUATION_TABS.find((t) => t.id === 'timeline')
    expect(timelineTab?.label).toBe('Cronología')
  })
})

describe('top priorities use real priority entities, not findings', () => {
  it('reads top_priorities and not priority_findings', () => {
    const src = read('components/TopPriorities.tsx')
    expect(src).toContain('top_priorities')
    expect(src).not.toContain('priority_findings')
    expect(src).toContain('Valor de verificar')
    expect(src).toContain('Preparación operativa')
    expect(src).toContain('No hay prioridades operativas disponibles')
  })
})

describe('module source is free of removed English strings', () => {
  const cases: Array<[string, string[]]> = [
    ['components/SituationOperationalHeader.tsx', ['Última sync', 'Pipelines con datos', 'Sistema operativo']],
    ['components/TopFindings.tsx', ['pipeline de inteligencia', 'priorización activa en pipeline']],
    ['components/IncidentsOverview.tsx', ['pendientes de ownership', 'Revisar legacy', 'Demo activa']],
    ['components/tabs/VerificacionTab.tsx', ['Planes legacy']],
    ['components/tabs/OperacionesTab.tsx', ['(demo)']],
  ]
  for (const [file, forbidden] of cases) {
    it(`${file} has no removed English strings`, () => {
      const src = read(file)
      for (const term of forbidden) expect(src).not.toContain(term)
    })
  }

  it('map legend and controls are translated', () => {
    const src = readAbs('src/modules/executive-demo/components/ExecutiveNationalMap.tsx')
    expect(src).not.toContain('◌ Legacy')
    expect(src).not.toMatch(/★ Demo\b/)
    expect(src).not.toContain('Active legacy o demo')
    expect(src).toContain('Registros históricos')
    expect(src).toContain('Incidentes operativos')
    expect(src).toContain('Active los registros históricos o de demostración cuando corresponda')
  })

  it('timeline heading is Cronología with translated epistemic', () => {
    const src = readAbs('src/modules/executive-demo/components/StoryTimeline.tsx')
    expect(src).not.toContain('Timeline nacional')
    expect(src).toContain('Cronología nacional')
    expect(src).toContain('epistemicLabel')
  })
})

describe('methodology panel — Spanish main copy only', () => {
  it('findings_active shows human source, not composite_findings in main panel', () => {
    const p = buildSituationMethodologyPresentation('findings_active')
    expect(p).not.toBeNull()
    const main = methodologyMainPanelText(p!)
    expect(main).toContain('Hallazgos compuestos con estado activo')
    expect(main).toContain('Estado actual')
    expect(main).toContain('Activo')
    for (const token of METHODOLOGY_FORBIDDEN_MAIN_TOKENS) {
      expect(mainPanelHasForbiddenToken(main, token), token).toBe(false)
    }
    expect(p!.technicalReference).toContain('composite_findings')
  })

  it('primary KPI registry entries have Spanish methodology main panels', () => {
    for (const id of [
      'fire_observations',
      'fire_detections_national',
      'fire_events',
      'findings_active',
      'incidents_operational',
    ]) {
      const p = buildSituationMethodologyPresentation(id)
      expect(p, id).not.toBeNull()
      const main = methodologyMainPanelText(p!)
      for (const token of METHODOLOGY_FORBIDDEN_MAIN_TOKENS) {
        expect(mainPanelHasForbiddenToken(main, token), `${id}: ${token}`).toBe(false)
      }
    }
  })

  it('ExecutiveKpiGrid uses presentation layer with technical reference collapsed', () => {
    const src = read('components/ExecutiveKpiGrid.tsx')
    expect(src).toContain('buildSituationMethodologyPresentation')
    expect(src).toContain('Referencia técnica')
    expect(src).toContain('kpi-methodology-panel')
    expect(src).not.toContain('metricMethodologyLines')
  })
})

describe('operational row responsive grid', () => {
  it('uses single column at lg when preview is hidden', () => {
    const overview = read('components/ExecutiveOverview.tsx')
    expect(overview).toContain('lg:grid-cols-1')
    expect(overview).toContain('xl:grid-cols-2')
  })
})

describe('priority change delta limitation', () => {
  it('documents accepted limitation in executive summary builder', () => {
    const src = readFileSync(
      resolve(ROOT, 'src/modules/national-situation/national-executive-summary.ts'),
      'utf8',
    )
    expect(src).toContain(
      'Los cambios de prioridad se incorporarán cuando exista una fuente temporal canónica para esa etapa',
    )
  })
})
