import { describe, expect, it } from 'vitest'

import type { PopulationZoneDto } from '@/modules/fires/types/fire.dto'
import { buildPopulationContextDto } from '@/modules/fires/utils/population-context.dto'
import { formatPopulationZoneDisplay } from '@/modules/fires/utils/population-zone-display'
import { RANGE_TOOLTIP } from '@/modules/territory/population/population-estimate-confidence'
import type {
  PopulationContextRow,
  PopulationZoneRow,
} from '@/pipeline/stores/population.store'

function sacatepequezZone(): PopulationZoneDto {
  const context: PopulationContextRow = {
    id: 'ctx-sac',
    entity_type: 'fire_event',
    entity_id: 'evt-sac',
    context_version: 'v1',
    source_dataset_id: null,
    reference_year: 2020,
    analysis_geometry_type: 'buffer_union',
    geometry_source: 'detections',
    estimated_population: 11,
    validation_summary: {},
    official_population_context: {},
    nearest_settlements: [],
    status: 'complete',
    warnings: [],
    generated_at: '2026-07-10T12:00:00.000Z',
    updated_at: '2026-07-10T12:00:00.000Z',
  }
  const zones: PopulationZoneRow[] = [
    {
      id: 'z-sac',
      context_id: 'ctx-sac',
      radius_m: 1000,
      estimated_population: 11,
      validation_estimate: 1259,
      absolute_difference: 1248,
      difference_pct: 11345,
      population_density_per_km2: 1,
      analyzed_area_ha: 314,
      data_coverage_pct: 95,
      warnings: [],
      generated_at: '2026-07-10T12:00:00.000Z',
    },
  ]
  return buildPopulationContextDto(context, zones)!.zones[0]!
}

describe('population-zone-display', () => {
  it('shows modelled range for very low confidence', () => {
    const zone = sacatepequezZone()
    const display = formatPopulationZoneDisplay(zone)
    expect(display.isRange).toBe(true)
    expect(display.primaryText).toContain('Rango:')
    expect(display.primaryText).toContain('11')
    expect(display.primaryText).not.toBe('11')
    expect(display.confidenceLabel).toContain('muy baja')
    expect(display.tooltip).toBe(RANGE_TOOLTIP)
    expect(display.tooltip).not.toContain('intervalo de confianza')
  })

  it('shows single estimate for high confidence', () => {
    const zone: PopulationZoneDto = {
      radius_m: 1000,
      estimated_population: 809,
      validation_estimate: 794,
      difference_pct: 1.9,
      confidence: {
        level: 'high',
        agreement_class: 'close',
        recommended_display_mode: 'single_estimate',
        reasons: [],
      },
      density_per_km2: 800,
      data_coverage_pct: 100,
      warnings: [],
    }
    const display = formatPopulationZoneDisplay(zone)
    expect(display.usePointEstimate).toBe(true)
    expect(display.primaryText).toContain('≈')
    expect(display.confidenceLabel).toContain('alta')
  })
})
