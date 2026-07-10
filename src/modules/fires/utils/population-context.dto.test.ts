import { describe, expect, it } from 'vitest'

import {
  buildPopulationContextDto,
  formatPopulationCompact,
} from '@/modules/fires/utils/population-context.dto'
import type {
  PopulationContextRow,
  PopulationZoneRow,
} from '@/pipeline/stores/population.store'

describe('population-context.dto', () => {
  it('formats compact population', () => {
    expect(formatPopulationCompact(1_200)).toBe('1.2 mil')
    expect(formatPopulationCompact(18_600)).toBe('18.6 mil')
  })

  it('builds safe DTO without sensitive keys', () => {
    const context: PopulationContextRow = {
      id: 'ctx-1',
      entity_type: 'fire_event',
      entity_id: 'evt-1',
      context_version: 'abc123',
      source_dataset_id: null,
      reference_year: 2020,
      analysis_geometry_type: 'buffer_union',
      geometry_source: 'detections',
      estimated_population: 5000,
      validation_summary: {},
      official_population_context: {
        status: 'available',
        department: {
          adminName: 'Retalhuleu',
          officialPopulation: 250000,
          referenceYear: 2020,
          projectionYear: 2020,
        },
      },
      nearest_settlements: [
        { name: 'Champerico', type: 'municipal_seat', distance_m: 2100, source: 'HDX COD-AB' },
      ],
      status: 'complete',
      warnings: ['settlement_dataset_limited_to_municipal_seats'],
      generated_at: '2026-07-10T12:00:00.000Z',
      updated_at: '2026-07-10T12:00:00.000Z',
    }
    const zones: PopulationZoneRow[] = [
      {
        id: 'z1',
        context_id: 'ctx-1',
        radius_m: 1000,
        estimated_population: 5000,
        validation_estimate: 4800,
        absolute_difference: 200,
        difference_pct: 4,
        population_density_per_km2: 500,
        analyzed_area_ha: 314,
        data_coverage_pct: 95,
        warnings: [],
        generated_at: '2026-07-10T12:00:00.000Z',
      },
    ]

    const dto = buildPopulationContextDto(context, zones)!
    expect(dto.status).toBe('complete')
    expect(dto.zones[0]?.estimated_population).toBe(5000)
    expect(dto.zones[0]?.confidence?.level).toBe('high')
    expect(dto.official_context.department?.name).toBe('Retalhuleu')
    expect(JSON.stringify(dto).toLowerCase()).not.toContain('gdal')
    expect(JSON.stringify(dto).toLowerCase()).not.toContain('afectad')
  })

  it('builds Sacatepéquez zone with modelled range not point estimate', () => {
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
    const dto = buildPopulationContextDto(context, zones)!
    expect(dto.zones[0]?.confidence?.level).toBe('very_low')
    expect(dto.zones[0]?.modelled_range).toEqual({ lower: 11, upper: 1259 })
    expect(dto.zones[0]?.confidence?.recommended_display_mode).toBe('modelled_range')
    expect(JSON.stringify(dto)).not.toContain('intervalo de confianza')
  })

  it('builds Sacatepéquez zone with modelled range not point estimate', () => {
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
    const dto = buildPopulationContextDto(context, zones)!
    expect(dto.zones[0]?.confidence?.level).toBe('very_low')
    expect(dto.zones[0]?.modelled_range).toEqual({ lower: 11, upper: 1259 })
    expect(dto.zones[0]?.confidence?.recommended_display_mode).toBe('modelled_range')
    expect(JSON.stringify(dto)).not.toContain('intervalo de confianza')
  })

  it('marks stale when detections newer than context', () => {
    const context: PopulationContextRow = {
      id: 'ctx-1',
      entity_type: 'fire_event',
      entity_id: 'evt-1',
      context_version: 'v1',
      source_dataset_id: null,
      reference_year: 2020,
      analysis_geometry_type: 'buffer_union',
      geometry_source: 'detections',
      estimated_population: 100,
      validation_summary: {},
      official_population_context: {},
      nearest_settlements: [],
      status: 'complete',
      warnings: [],
      generated_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }
    const dto = buildPopulationContextDto(context, [], {
      eventLastLinkedAt: '2026-07-10T00:00:00.000Z',
    })
    expect(dto?.status).toBe('stale')
  })
})
