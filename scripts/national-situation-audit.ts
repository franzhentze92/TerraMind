#!/usr/bin/env tsx
/**
 * national-situation:audit — Product Consolidation Phase 3 gate.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  PRIMARY_KPI_LIMIT,
  PRIMARY_KPI_METRIC_IDS,
  buildPrimaryKpis,
  CURRENT_STATE_METRIC_IDS,
} from '@/modules/national-situation/national-situation.constants'
import { buildNationalExecutiveSummary } from '@/modules/national-situation/national-executive-summary'
import { buildExecutiveMetricsFromContext } from '../server/services/executive-metrics.service.js'
import { findInternalPhaseCodes } from '@/shared/product-language'

const ROOT = process.cwd()
const failures: string[] = []
const passes: string[] = []

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) passes.push(name)
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
}

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8')
}

// Required deliverables
const requiredFiles = [
  'docs/product-consolidation/PHASE-3-SITUATION-AUDIT.md',
  'src/modules/national-situation/NationalSituationContext.tsx',
  'src/modules/national-situation/national-situation.constants.ts',
  'src/modules/national-situation/national-executive-summary.ts',
  'src/modules/national-situation/components/ExecutiveOverview.tsx',
  'src/modules/national-situation/components/ExecutiveKpiGrid.tsx',
  'src/modules/national-situation/components/ExecutiveSummary.tsx',
  'src/modules/national-situation/components/TopFindings.tsx',
  'src/modules/national-situation/components/OperationalCycleStatus.tsx',
  'src/modules/national-situation/components/IntelligenceLineDrawer.tsx',
  'src/modules/national-situation/components/SourcesStatusDrawer.tsx',
  'src/modules/national-situation/components/SituationTabs.tsx',
  'src/modules/national-situation/national-situation.test.ts',
  'scripts/national-situation-audit.ts',
]

for (const f of requiredFiles) {
  check(`file:${f}`, existsSync(resolve(ROOT, f)))
}

// KPI limit
check('primary-kpi-limit', PRIMARY_KPI_LIMIT === 6)
const syntheticCtx = {
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
}

const metrics = buildExecutiveMetricsFromContext(syntheticCtx, { include_demo: false })
const kpis = buildPrimaryKpis(metrics, 0)
check('primary-kpi-count', kpis.length === 6, `got ${kpis.length}`)
check(
  'primary-kpi-uses-registry',
  PRIMARY_KPI_METRIC_IDS.every((id) => kpis.some((k) => k.id === id)),
)

const incidentsKpi = kpis.find((k) => k.id === 'incidents_operational')
check('legacy-not-operational-headline', incidentsKpi?.value === 0)
check('legacy-breakdown-visible', Boolean(incidentsKpi?.secondary?.includes('histórico')))
check(
  'legacy-breakdown-no-english',
  !/legacy|ownership/i.test(incidentsKpi?.secondary ?? ''),
)

const summaryNoAssessment = buildNationalExecutiveSummary(metrics, {
  generated_at: new Date().toISOString(),
  system_status: 'operational',
  last_sync_at: null,
  sources_active: 1,
  include_demo: false,
  metrics: [],
  summary: {} as never,
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
})
check(
  'no-formal-recommendation-without-assessment',
  summaryNoAssessment.terramind_recommends.includes('Aún no existe una recomendación operacional formal'),
)
check(
  'no-invented-change-delta',
  summaryNoAssessment.what_changed.includes('No hay suficiente historial comparable'),
)

// Page must not use forbidden patterns
const pageSrc = read('src/modules/national-center/pages/NationalSituationPage.tsx')
check('page-uses-provider', pageSrc.includes('NationalSituationProvider'))
check('page-no-country-indicators', !pageSrc.includes('CountryIndicatorsPanel'))
check('page-no-sources-footer', !pageSrc.includes('SourcesFooter'))
check('page-no-live-timeline-sticky', !pageSrc.includes('LiveTimelinePanel'))
check('page-no-national-metrics-panel', !pageSrc.includes('NationalMetricsPanel'))
check('page-no-command-center-stack', !pageSrc.includes('ExecutiveNationalCommandCenter'))

const overviewSrc = read('src/modules/national-situation/components/ExecutiveOverview.tsx')
check('overview-has-kpi-grid', overviewSrc.includes('ExecutiveKpiGrid'))
check('overview-has-map', overviewSrc.includes('ExecutiveNationalMap'))
check('overview-has-tabs', overviewSrc.includes('SituationTabs'))

const kpiSrc = read('src/modules/national-situation/components/ExecutiveKpiGrid.tsx')
check('kpi-uses-context-metrics', kpiSrc.includes('useNationalSituation'))
check('kpi-not-executive-metric-grid', !kpiSrc.includes('ExecutiveMetricGrid'))

const intelSrc = read('src/modules/national-situation/components/IntelligenceLineDrawer.tsx')
check('intelligence-is-drawer', intelSrc.includes('intelligence-line-drawer'))
check('intelligence-not-sticky-column', !intelSrc.includes('sticky top-0'))

const mapSrc = read('src/modules/executive-demo/components/ExecutiveNationalMap.tsx')
check('map-layer-toggles', mapSrc.includes('showLegacyLayer') && mapSrc.includes('Centrar Guatemala'))
check('map-partial-error', mapSrc.includes('isError'))

const cycleSrc = read('src/modules/national-situation/components/OperationalCycleStatus.tsx')
check('compact-cycle-state', cycleSrc.includes('operational-cycle-status'))

// Current-state metrics labeled
check(
  'findings-is-current-state',
  CURRENT_STATE_METRIC_IDS.has('findings_active'),
)

// No internal phase codes in visible strings
const visibleFiles = [
  'src/modules/national-situation/components/ExecutiveSummary.tsx',
  'src/modules/national-situation/components/SituationOperationalHeader.tsx',
  'src/modules/national-situation/national-executive-summary.ts',
]
for (const f of visibleFiles) {
  const src = read(f)
  const codes = findInternalPhaseCodes(src)
  check(`no-phase-code:${f}`, codes.length === 0, codes.join(', '))
}

// Stale / partial error states exist (health label lives in the presentation helper)
const situationLabelsSrc = read('src/modules/national-situation/utils/situation-labels.ts')
check('stale-badge', situationLabelsSrc.includes('Datos retrasados'))
const headerSrc = read('src/modules/national-situation/components/SituationOperationalHeader.tsx')
check('header-uses-health-resolver', headerSrc.includes('resolveSystemHealth'))

const sourcesSrc = read('src/modules/national-situation/components/SourcesStatusDrawer.tsx')
check('sources-drawer-not-fixed-footer', sourcesSrc.includes('sources-status-drawer'))

console.log(`\nPhase 3 National Situation Audit`)
console.log(`Passed: ${passes.length}`)
console.log(`Failed: ${failures.length}`)
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`)
  process.exit(1)
}
console.log('AUDIT PASSED')
process.exit(0)
