import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { buildThermalEventDisplayName } from '@/modules/fires/utils/thermal-event-display'
import {
  FIRMS_DISPLAY,
  THERMAL_SCIENTIFIC_DISCLAIMER,
  detectionsToggleLabel,
  filterEmptyMessage,
  firmsProviderSummary,
  pluralizeCount,
  thermalLifecycleLabel,
  thermalPeriodLabel,
} from '@/modules/fires/utils/thermal-labels'
import { resolveThermalDataStatus } from '@/modules/fires/utils/thermal-data-status'
import { buildFireDataStatus } from '@/modules/fires/api/fire-ingestion-status'
import { mapEventRowToDto } from '@/modules/fires/api/fire-api.mappers'

const ROOT = process.cwd()

function readModule(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8')
}

const UI_FILES = [
  'src/modules/fires/pages/FireAnalysisPage.tsx',
  'src/modules/fires/components/FireSummaryStrip.tsx',
  'src/modules/fires/components/FireFilters.tsx',
  'src/modules/fires/components/FireEventsTable.tsx',
  'src/modules/fires/components/FireEventsMap.tsx',
  'src/modules/fires/components/FireMapLegend.tsx',
  'src/modules/fires/components/FireEventDetailPanel.tsx',
  'src/modules/fires/components/ThermalDataStatusLine.tsx',
]

const FORBIDDEN_UI_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bhotspot\b/i, reason: 'hotspot label' },
  { pattern: /\bPipeline operativo\b/, reason: 'English pipeline label' },
  { pattern: /\bPipeline con fallos\b/, reason: 'pipeline wording' },
  { pattern: /\bON\b|\bOFF\b/, reason: 'English toggle' },
  { pattern: /resultado\(s\)|evento\(s\)|deteccion\(s\)|fuente\(s\)/i, reason: 'English plural (s)' },
  { pattern: />{s}</, reason: 'raw FIRMS source enum in JSX' },
]

describe('thermal presentation language', () => {
  it('documents FIRMS in Spanish', () => {
    expect(FIRMS_DISPLAY).toContain('Sistema de información satelital')
  })

  it('shows scientific limitation copy', () => {
    expect(THERMAL_SCIENTIFIC_DISCLAIMER).toContain('no confirma')
  })

  it('pluralizes detecciones and fuentes', () => {
    expect(pluralizeCount(1, 'detección', 'detecciones')).toBe('1 detección')
    expect(pluralizeCount(4, 'fuente', 'fuentes')).toBe('4 fuentes')
  })

  it('translates lifecycle states for product UI', () => {
    expect(thermalLifecycleLabel('lifecycle_expanding')).toBe('En expansión')
    expect(thermalLifecycleLabel('persistent')).toBe('Persistente')
    expect(thermalLifecycleLabel('declining')).toBe('En descenso')
  })

  it('uses deterministic event names without raw IDs', () => {
    const name = buildThermalEventDisplayName({
      department_name: 'Petén',
      first_detected_at: '2026-07-09T18:00:00.000Z',
      validation_status: 'no_validado',
    })
    expect(name).toContain('Evento térmico')
    expect(name).toContain('Petén')
    expect(name).not.toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('only uses incendio when validation is confirmado', () => {
    const confirmed = buildThermalEventDisplayName({
      department_name: 'Huehuetenango',
      first_detected_at: '2026-07-09T18:00:00.000Z',
      validation_status: 'confirmado',
    })
    const probable = buildThermalEventDisplayName({
      department_name: 'Huehuetenango',
      first_detected_at: '2026-07-09T18:00:00.000Z',
      validation_status: 'probable',
    })
    expect(confirmed).toContain('Incendio verificado')
    expect(probable).not.toContain('Incendio')
  })

  it('distinguishes filter-empty vs period-empty messages', () => {
    expect(filterEmptyMessage(true)).toContain('filtros')
    expect(filterEmptyMessage(false)).toContain('periodo')
  })

  it('uses Spanish toggle labels', () => {
    expect(detectionsToggleLabel(true)).toBe('Activado')
    expect(detectionsToggleLabel(false)).toBe('Desactivado')
  })

  it('labels period windows in Spanish', () => {
    expect(thermalPeriodLabel('48h')).toContain('48 horas')
  })

  it('uses single canonical data status labels', () => {
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
    expect(['Datos actualizados', 'Datos parcialmente actualizados', 'Datos retrasados', 'Proceso con fallos', 'Sin datos recientes']).toContain(
      status.label,
    )
  })

  it('formats FIRMS provider summary in Spanish', () => {
    expect(firmsProviderSummary(4, 4)).toBe('Proveedores FIRMS operativos: 4 de 4')
  })
})

describe('thermal UI files avoid visible English product copy', () => {
  for (const file of UI_FILES) {
    it(`scan ${file}`, () => {
      const src = readModule(file)
      for (const { pattern, reason } of FORBIDDEN_UI_PATTERNS) {
        expect(src, `${file}: ${reason}`).not.toMatch(pattern)
      }
    })
  }
})

describe('thermal count parity — mapper does not alter canonical fields', () => {
  it('preserves detection and satellite counts from row', () => {
    const dto = mapEventRowToDto({
      id: 'evt-1',
      status: 'active',
      validation_status: 'no_validado',
      risk_level: 'observacion',
      priority_score: 42,
      centroid_lat: 14.6,
      centroid_lng: -90.5,
      first_detected_at: '2026-07-09T10:00:00.000Z',
      last_detected_at: '2026-07-09T12:00:00.000Z',
      persistence_hours: 2,
      detection_count: 5,
      satellite_count: 2,
      source_products: ['VIIRS_SNPP_NRT'],
      max_frp_mw: 12.5,
      geometry_method: 'convex_hull_buffer',
      created_at: '2026-07-09T10:00:00.000Z',
      metadata: null,
      geo_departments: { code: '01', name: 'Guatemala' },
    })
    expect(dto.detection_count).toBe(5)
    expect(dto.satellite_count).toBe(2)
    expect(dto.priority_score).toBe(42)
  })
})
