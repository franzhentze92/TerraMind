import { describe, expect, it } from 'vitest'

import { buildClimateContextDto, CLIMATE_SENSITIVE_KEYS } from '@/modules/fires/utils/climate-context.dto'
import { assertClimateNarrativeSafe, buildClimateEventNarrative } from '@/modules/fires/utils/climate-narrative'
import type { ClimateContextRow } from '@/pipeline/stores/climate.store'

describe('climate-context.dto', () => {
  it('builds safe DTO without coordinates or API URLs', () => {
    const row: ClimateContextRow = {
      id: 'ctx-1',
      entity_type: 'fire_event',
      entity_id: 'evt-1',
      context_version: 'abc',
      status: 'complete',
      provider: 'open_meteo',
      model_name: 'open-meteo-forecast',
      generated_at: '2026-07-10T12:00:00.000Z',
      event_time_start: '2026-07-10T10:00:00.000Z',
      event_time_end: '2026-07-10T11:00:00.000Z',
      geometry_source: 'detections_sample',
      point_count: 2,
      temporal_alignment: 'exact',
      conditions_summary: {
        matched_time: '2026-07-10T10:00:00.000Z',
        temperature_c: { mean: 28, min: 27, max: 29 },
        relative_humidity_pct: { mean: 55, min: 50 },
        wind_speed_kmh: { mean: 12, max: 18 },
        wind_gust_kmh: { max: 25 },
        wind_direction: { degrees: 225, cardinal: 'SW', toward_cardinal: 'NE' },
        precipitation_mm: { mean: 0, max: 0 },
      },
      antecedent_summary: {
        precipitation_previous_24h_mm: 0,
        precipitation_previous_7d_mm: 3,
        precipitation_previous_30d_mm: 40,
        dry_days_consecutive: 5,
        max_temperature_previous_24h_c: 32,
        min_relative_humidity_previous_24h_pct: 35,
      },
      forecast_summary: {
        available: true,
        precipitation_next_24h_mm: 2,
        precipitation_next_72h_mm: 8,
        max_wind_speed_next_24h_kmh: 20,
        max_wind_gust_next_24h_kmh: 35,
      },
      source_metadata: { spatial_variability: { point_count: 2, level: 'low' } },
      warnings: [],
      created_at: '2026-07-10T12:00:00.000Z',
      updated_at: '2026-07-10T12:00:00.000Z',
    }

    const dto = buildClimateContextDto(row)!
    expect(dto.status).toBe('complete')
    expect(dto.event_conditions.temperature_c?.mean).toBe(28)
    const json = JSON.stringify(dto).toLowerCase()
    for (const key of CLIMATE_SENSITIVE_KEYS) {
      expect(json).not.toContain(key)
    }
    expect(json).not.toContain('observado')
  })
})

describe('climate-narrative', () => {
  it('uses modelled semantics', () => {
    const dto = buildClimateContextDto({
      id: 'c',
      entity_type: 'fire_event',
      entity_id: 'e',
      context_version: 'v',
      status: 'complete',
      provider: 'open_meteo',
      model_name: 'open-meteo-forecast',
      generated_at: '2026-07-10T12:00:00.000Z',
      event_time_start: null,
      event_time_end: null,
      geometry_source: 'detections_sample',
      point_count: 1,
      temporal_alignment: 'exact',
      conditions_summary: {
        temperature_c: { mean: 30 },
        relative_humidity_pct: { mean: 40 },
        wind_speed_kmh: { mean: 10 },
        wind_direction: { cardinal: 'SW', toward_cardinal: 'NE' },
      },
      antecedent_summary: { precipitation_previous_24h_mm: 0 },
      forecast_summary: { available: true, precipitation_next_72h_mm: 5 },
      source_metadata: {},
      warnings: [],
      created_at: '2026-07-10T12:00:00.000Z',
      updated_at: '2026-07-10T12:00:00.000Z',
    } as ClimateContextRow)!

    const text = buildClimateEventNarrative(dto)
    expect(text).toContain('condición modelada')
    expect(text).toContain('SW')
    assertClimateNarrativeSafe(text)
  })
})
