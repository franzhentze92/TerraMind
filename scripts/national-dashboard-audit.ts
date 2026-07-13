#!/usr/bin/env tsx
/**
 * national-dashboard:audit — Situación Nacional future-state dashboard gate.
 *
 * Fails if the redesigned dashboard drifts from the honesty/registry contract:
 * hardcoded reference figures, hardcoded/unimplemented event types, disabled
 * types leaking, "342 municipios" as official, map/distribution not driven by
 * the registry, missing honest empty states, etc.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { ensureEventsRegistered } from '@/modules/environmental-events/registry/register-all'
import { environmentalEventRegistry } from '@/modules/environmental-events/registry/event-type-registry'
import { GUATEMALA_MUNICIPALITY_COUNT } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.municipal'
import {
  buildPrimaryKpis,
  countActiveMissions,
} from '@/modules/national-situation/national-situation.constants'

const ROOT = process.cwd()
const failures: string[] = []
const passes: string[] = []

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) passes.push(name)
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
}

function read(rel: string): string {
  const p = resolve(ROOT, rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : ''
}

const COMPONENTS_DIR = 'src/modules/national-situation/components'

const dashboardFiles = [
  `${COMPONENTS_DIR}/ExecutiveOverview.tsx`,
  `${COMPONENTS_DIR}/ExecutiveKpiGrid.tsx`,
  `${COMPONENTS_DIR}/EventTypeBreakdown.tsx`,
  `${COMPONENTS_DIR}/ExecutiveSummary.tsx`,
  `${COMPONENTS_DIR}/SelectedEventPanel.tsx`,
  `${COMPONENTS_DIR}/EventDistributionChart.tsx`,
  `${COMPONENTS_DIR}/OperationalStatusPanel.tsx`,
  `${COMPONENTS_DIR}/IntelligenceTimeline.tsx`,
  `${COMPONENTS_DIR}/TerritorialPanorama.tsx`,
  `${COMPONENTS_DIR}/NationalEventMap.tsx`,
  'src/modules/national-situation/hooks/useDashboardEventTypes.ts',
  'src/modules/executive-demo/components/ExecutiveNationalMap.tsx',
]

// 1. Required deliverables exist
for (const f of dashboardFiles) {
  check(`file:${f}`, existsSync(resolve(ROOT, f)))
}

const allSrc = dashboardFiles.map(read).join('\n')

// 2. No hardcoded reference figures from the mock image
const FORBIDDEN_FIGURES = [
  '12,436',
  '12436',
  '1.2M',
  '6,850',
  '342 municipios',
  '342 comunidades',
  '19 de 22',
  '19 departamentos',
]
for (const fig of FORBIDDEN_FIGURES) {
  check(`no-hardcoded-figure:${fig}`, !allSrc.includes(fig))
}

// 3. No hardcoded unimplemented event-type labels (must come from the registry)
const FORBIDDEN_TYPE_LABELS = [
  'Inundaciones',
  'Lluvia extrema',
  'Lluvias extremas',
  'Deslizamientos',
  'Presión sobre cobertura natural',
  'Presión cobertura natural',
  'Riesgo agrícola',
]
for (const label of FORBIDDEN_TYPE_LABELS) {
  check(`no-hardcoded-type-label:${label}`, !allSrc.includes(label))
}

// 4. "342 municipios" never presented as the official count anywhere in src
const municipalUi = read('src/modules/precipitation/rainfall-deficit/rainfall-deficit.municipal.ts')
check('municipality-count-340', GUATEMALA_MUNICIPALITY_COUNT === 340)
check('no-342-municipios-literal', !allSrc.includes('342 municipios') && !municipalUi.includes('342 municipios'))

// 5. Map is registry-driven, no per-type branching literals
const mapSrc = read(`${COMPONENTS_DIR}/NationalEventMap.tsx`)
check('map-uses-registry-renderer', mapSrc.includes('getMapRenderer'))
check(
  'map-no-hardcoded-type-literals',
  !mapSrc.includes("'thermal_activity'") && !mapSrc.includes("'rainfall_deficit'"),
)
check('map-color-from-feature-or-accent', mapSrc.includes('accentColor') || mapSrc.includes('fill_color'))

// 6. Distribution + breakdown driven by the registry-backed hook
const distSrc = read(`${COMPONENTS_DIR}/EventDistributionChart.tsx`)
const breakdownSrc = read(`${COMPONENTS_DIR}/EventTypeBreakdown.tsx`)
check('distribution-uses-registry-types', distSrc.includes('eventTypes') && distSrc.includes('accentColor'))
check('breakdown-uses-registry-types', breakdownSrc.includes('eventTypes') && breakdownSrc.includes('accentColor'))

// 7. Single canonical metric source for KPIs
const kpiSrc = read(`${COMPONENTS_DIR}/ExecutiveKpiGrid.tsx`)
check('kpis-canonical-source', kpiSrc.includes('useNationalSituation'))
check('kpis-honest-no-comparison', kpiSrc.includes('Sin periodo comparable'))

// 7b. Visible KPI row matches TerraMind's model and never fakes threats.
// Synthetic canonical context: 50 findings + 12 priorities must NOT become
// 50/12 threats; the threat KPI stays unavailable until the engine exists.
const auditMetrics = [
  {
    id: 'fire_observations',
    label: 'Observaciones totales',
    value: 6,
    scope: 'national' as const,
    classification: 'operational' as const,
    timeWindow: { key: '48h' as const, label: 'Últimas 48 horas' },
    breakdown: [],
    source: 'fire_ingestion_runs',
    limitations: [],
  },
  {
    id: 'findings_active',
    label: 'Hallazgos activos',
    value: 50,
    scope: 'national' as const,
    classification: 'operational' as const,
    timeWindow: { key: 'all_time' as const, label: 'Estado actual' },
    breakdown: [],
    source: 'findings',
    limitations: [],
  },
]
const auditKpis = buildPrimaryKpis({
  metrics: auditMetrics,
  eventsActive: 18,
  activeMissions: 0,
  activeResponses: 0,
  pendingDecisions: 0,
})
const auditKpiIds = auditKpis.map((k) => k.id)
check(
  'kpi-visible-order',
  JSON.stringify(auditKpiIds) ===
    JSON.stringify([
      'fire_observations',
      'events_active',
      'priority_threats',
      'active_missions',
      'active_responses',
      'pending_decisions',
    ]),
  auditKpiIds.join(','),
)
check('kpi-no-findings-in-row', !auditKpiIds.includes('findings_active'))
check('kpi-no-incidents-in-row', !auditKpiIds.includes('incidents_operational'))
const threatKpi = auditKpis.find((k) => k.id === 'priority_threats')
check('threat-kpi-unavailable', threatKpi?.unavailable?.status === 'not_implemented')
check(
  'threat-kpi-not-a-proxy-count',
  threatKpi?.value !== 50 && threatKpi?.value !== 12 && threatKpi?.value !== 18,
)

// 7c. Responses must never be inferred from missions/recommendations.
const missionSample = [
  { status: 'in_progress', is_internal_demo: false },
  { status: 'assigned', is_internal_demo: false },
]
check('missions-count-active-only', countActiveMissions(missionSample, false) === 2)
// A row full of active missions must not turn into responses (responses are 0
// unless a canonical active-response source feeds them).
const responsesKpi = buildPrimaryKpis({
  metrics: auditMetrics,
  eventsActive: 18,
  activeMissions: 2,
  activeResponses: 0,
  pendingDecisions: 0,
}).find((k) => k.id === 'active_responses')
check('responses-not-inferred-from-missions', responsesKpi?.value === 0)

// 7d. Threat icon is a differentiated executive icon (not an event-type icon).
const kpiModelSrc = read('src/modules/national-situation/utils/executive-kpi-panel-model.ts')
check('threat-uses-shield-icon', kpiModelSrc.includes('ShieldAlert'))

// 8. Accent color comes from the manifest (single visual source of truth)
const hookSrc = read('src/modules/national-situation/hooks/useDashboardEventTypes.ts')
check('accent-color-from-registry', hookSrc.includes('getAccentColor'))

// 9. Honest empty states present across panels
const emptyStatePanels: Array<[string, string]> = [
  [`${COMPONENTS_DIR}/EventDistributionChart.tsx`, 'No se detectaron eventos activos'],
  [`${COMPONENTS_DIR}/OperationalStatusPanel.tsx`, 'No hay operaciones activas'],
  [`${COMPONENTS_DIR}/IntelligenceTimeline.tsx`, 'No se registraron hitos'],
  [`${COMPONENTS_DIR}/SelectedEventPanel.tsx`, 'Seleccione un evento'],
  [`${COMPONENTS_DIR}/TerritorialPanorama.tsx`, 'No hay métricas territoriales'],
]
for (const [file, phrase] of emptyStatePanels) {
  check(`empty-state:${file}`, read(file).includes(phrase))
}

// 10. Operational panel does not mix historical into active counts
const opsSrc = read(`${COMPONENTS_DIR}/OperationalStatusPanel.tsx`)
check('ops-excludes-demo-unless-toggle', opsSrc.includes('includeDemo'))

// 11. Runtime: no disabled type is enabled by default on the client registry
ensureEventsRegistered()
const enabled = environmentalEventRegistry.enabledTypes()
check('thermal-enabled-by-default', enabled.includes('thermal_activity'))
check(
  'rainfall-not-enabled-by-default',
  !environmentalEventRegistry.get('rainfall_deficit').runtime.enabledByDefault,
)

// 12. Territorial panorama uses cautious language (no "afectados/en riesgo" claims from spatial signal)
const territorySrc = read(`${COMPONENTS_DIR}/TerritorialPanorama.tsx`)
check(
  'territory-cautious-language',
  !/personas afectadas|comunidades en riesgo|infraestructura dañada/i.test(territorySrc),
)

console.log(`\nNational Dashboard Audit`)
console.log(`Passed: ${passes.length}`)
console.log(`Failed: ${failures.length}`)
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`)
  process.exit(1)
}
console.log('AUDIT PASSED')
process.exit(0)
