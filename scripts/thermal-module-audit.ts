#!/usr/bin/env tsx
/**
 * thermal-module:audit — Actividad térmica product polish + multi-event readiness gate.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { computeThermalResultCounts } from '@/modules/fires/utils/thermal-result-count'
import { resolveThermalDataStatus } from '@/modules/fires/utils/thermal-data-status'
import { buildThermalEventDisplayName } from '@/modules/fires/utils/thermal-event-display'
import {
  THERMAL_SCIENTIFIC_DISCLAIMER,
  thermalLifecycleLabel,
} from '@/modules/fires/utils/thermal-labels'
import { buildFireDataStatus } from '@/modules/fires/api/fire-ingestion-status'
import { mapEventRowToDto } from '@/modules/fires/api/fire-api.mappers'
import type { FireEventListItemDto } from '@/modules/fires/types/fire.dto'

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

const requiredFiles = [
  'docs/multi-event/THERMAL-MODULE-READINESS-AUDIT.md',
  'src/modules/fires/utils/thermal-labels.ts',
  'src/modules/fires/utils/thermal-data-status.ts',
  'src/modules/fires/utils/thermal-result-count.ts',
  'src/modules/fires/utils/thermal-event-display.ts',
  'src/modules/fires/components/ThermalDataStatusLine.tsx',
  'src/modules/fires/thermal-language.test.ts',
  'scripts/thermal-module-audit.ts',
]

for (const f of requiredFiles) {
  check(`file:${f}`, existsSync(resolve(ROOT, f)))
}

// Language — page header and disclaimer
const pageSrc = read('src/modules/fires/pages/FireAnalysisPage.tsx')
check('language:page-title', pageSrc.includes('title="Actividad térmica"'))
check('language:scientific-disclaimer', pageSrc.includes('THERMAL_SCIENTIFIC_DISCLAIMER'))
check('language:no-on-off-toggle', !/\bON\b|\bOFF\b/.test(pageSrc))
check('language:no-math-max-counter', !/Math\.max\([^)]*pagination\.total|Math\.max\([^)]*items\.length/.test(pageSrc))

// Single data status line (no duplicate stale/partial badges)
check(
  'status:single-line',
  pageSrc.includes('ThermalDataStatusLine') &&
    !pageSrc.includes('Datos desactualizados') &&
    !pageSrc.includes('Ingesta parcial'),
)

// Result count semantics
const counts = computeThermalResultCounts({
  serverFilteredTotal: 12,
  currentPageItems: [{ id: 'a' }],
  isFetching: false,
  isPlaceholderData: false,
})
check('count:visible-equals-server', counts.visibleResultCount === 12)
check('count:no-math-max', counts.visibleResultCount === counts.serverFilteredTotal)

const staleCounts = computeThermalResultCounts({
  serverFilteredTotal: 0,
  currentPageItems: [{ id: 'stale' }],
  isFetching: true,
  isPlaceholderData: true,
})
check('count:placeholder-clears-rows', staleCounts.currentPageItemCount === 0)

// Hooks — no placeholderData on events query
const eventsHook = read('src/modules/fires/hooks/useFireEvents.ts')
check('count:no-placeholder-data', !eventsHook.includes('placeholderData'))

// KPI strip distinguishes observation / detection / event
const kpiSrc = read('src/modules/fires/components/FireSummaryStrip.tsx')
check('kpi:observations', kpiSrc.includes('Observaciones recibidas'))
check('kpi:national-detections', kpiSrc.includes('Detecciones nacionales'))
check('kpi:grouped-events', kpiSrc.includes('Eventos térmicos agrupados'))

// Filters use display names for sources
const filtersSrc = read('src/modules/fires/components/FireFilters.tsx')
check('filters:source-display-name', filtersSrc.includes('sourceProductDisplayName'))

// Table uses deterministic names
const tableSrc = read('src/modules/fires/components/FireEventsTable.tsx')
check('table:event-display-name', tableSrc.includes('buildThermalEventDisplayName'))

// Data status labels in Spanish
const status = resolveThermalDataStatus({
  dataStatus: buildFireDataStatus({
    lastFirmsIngestionAt: new Date().toISOString(),
    lastSuccessfulIngestionAt: new Date().toISOString(),
    latestSatelliteAcquisitionAt: new Date().toISOString(),
    sourcesWithDetections: 2,
    ingestion: {
      sources_expected: 4,
      sources_queried_successfully: 4,
      sources_failed: 0,
      failed_source_names: [],
      ingestion_status: 'success',
      is_partial: false,
      observations_downloaded: 10,
    },
    isStale: false,
    staleAfterMinutes: 180,
  }),
})
check('status:spanish-labels', status.label === 'Datos actualizados')

// Lifecycle translation
check('lifecycle:expanding-es', thermalLifecycleLabel('lifecycle_expanding') === 'En expansión')

// Event naming
const sampleName = buildThermalEventDisplayName({
  department_name: 'Petén',
  first_detected_at: '2026-07-09T18:00:00.000Z',
  validation_status: 'no_validado',
})
check('event:readable-name', sampleName.includes('Evento térmico') && !sampleName.match(/^[0-9a-f-]{36}$/i))

// Parity — mapper preserves counts
const dto = mapEventRowToDto({
  id: 'evt-parity',
  status: 'active',
  validation_status: 'probable',
  risk_level: 'observacion',
  priority_score: 33,
  centroid_lat: 14,
  centroid_lng: -90,
  first_detected_at: '2026-07-09T10:00:00.000Z',
  last_detected_at: '2026-07-09T11:00:00.000Z',
  persistence_hours: 1,
  detection_count: 7,
  satellite_count: 3,
  source_products: ['VIIRS_SNPP_NRT'],
  max_frp_mw: 9,
  geometry_method: 'single_detection_buffer',
  created_at: '2026-07-09T10:00:00.000Z',
  metadata: null,
  geo_departments: { code: '10', name: 'Petén' },
})
check('parity:detection-count', dto.detection_count === 7)
check('parity:satellite-count', dto.satellite_count === 3)

// Forbidden visible English in key UI files
const forbidden = [
  { file: 'src/modules/fires/pages/FireAnalysisPage.tsx', pattern: /\bhotspot\b/i },
  { file: 'src/modules/fires/components/FirePipelineStatusLine.tsx', pattern: /Pipeline operativo|Pipeline con fallos/ },
  { file: 'src/modules/fires/components/FireFilters.tsx', pattern: /VIIRS_SNPP_NRT/ },
]
for (const { file, pattern } of forbidden) {
  check(`forbidden:${file}`, !pattern.test(read(file)))
}

// Audit doc sections
const auditDoc = read('docs/multi-event/THERMAL-MODULE-READINESS-AUDIT.md')
check('audit:backend-coupling-table', auditDoc.includes('| Acoplamiento | Archivo |'))
check('audit:frontend-coupling-table', auditDoc.includes('| Componente |'))
check('audit:event-contract', auditDoc.includes('FireEventListItemDto'))
check('audit:framework-proposal', auditDoc.includes('EnvironmentalEvent'))
check('audit:map-point-assumptions', auditDoc.includes('Point'))

// Priority must come from API hooks, not local calculation in page
check(
  'priority:not-local',
  !pageSrc.includes('priority_score =') && pageSrc.includes('useFireEventPriority') === false,
)
check(
  'priority:detail-from-engine',
  read('src/modules/fires/components/FireEventDetailPanel.tsx').includes('useFireEventPriority'),
)

console.log('')
console.log(`thermal-module:audit — ${passes.length} passed, ${failures.length} failed`)
console.log('')
for (const p of passes) console.log(`  ✓ ${p}`)
for (const f of failures) console.log(`  ✗ ${f}`)

if (failures.length > 0) {
  console.log('')
  process.exit(1)
}

console.log('')
console.log('Actividad térmica — readiness audit OK')
