import { describe, expect, it } from 'vitest'
import {
  assertSafeClimateDto,
  toClimateHealthDto,
  toClimateSnapshotDto,
} from './climate-api.dto'
import type { ClimateSnapshot } from '../types/climate.types'

const snapshot: ClimateSnapshot = {
  location: {
    id: '11111111-1111-4111-8111-111111111111',
    location_key: 'country:geo_countries:GT',
    name: 'Guatemala',
    latitude: 15.5,
    longitude: -90.2,
    elevation_m: null,
    timezone: 'America/Guatemala',
    location_type: 'country',
    related_entity_type: 'geo_countries',
    related_entity_id: 'GT',
    is_active: true,
    created_at: '2026-07-10T00:00:00.000Z',
    updated_at: '2026-07-10T00:00:00.000Z',
  },
  current: {
    observed_at: '2026-07-10T03:15',
    temperature_c: 16.9,
    relative_humidity_pct: 97,
    precipitation_mm: 0,
    rain_mm: 0,
    wind_speed_10m_kph: 8.3,
    wind_direction_10m_deg: 344,
    wind_gusts_10m_kph: 18.4,
    cloud_cover_pct: 89,
    surface_pressure_hpa: 854.8,
    provider: 'open_meteo',
    model: 'open-meteo-forecast',
    source_timestamp: '2026-07-10T09:16:00.000Z',
  },
  forecast_summary: {
    rain_accum_24h_mm: 1.2,
    rain_accum_72h_mm: 3.4,
    rain_accum_7d_mm: null,
    max_gust_24h_kph: 30,
    min_humidity_24h_pct: 55,
    max_temperature_24h_c: 28,
    hours_with_rain_probability_gte_threshold: 4,
    rain_probability_threshold_pct: 50,
    hours_without_forecast_rain: 10,
    wind_direction_cardinal: 'N',
  },
  hourly: [],
  data_status: {
    provider: 'open_meteo',
    model: 'open-meteo-forecast',
    fetched_at: '2026-07-10T09:16:00.000Z',
    next_refresh_at: '2026-07-10T10:16:00.000Z',
    is_stale: false,
    quality: {
      provider: 'open_meteo',
      observed_or_modelled: 'modelled',
      spatial_resolution_km: 11,
      temporal_resolution_minutes: 60,
      completeness_pct: 100,
      stale: false,
      warnings: ['Datos modelados por Open-Meteo; no constituyen medición oficial de Guatemala.'],
    },
  },
}

describe('climate-api.dto', () => {
  it('maps snapshot without internal fields', () => {
    const dto = toClimateSnapshotDto(snapshot)
    expect(dto.location.name).toBe('Guatemala')
    expect(dto.current?.temperature_c).toBe(16.9)
    expect(JSON.stringify(dto)).not.toContain('source_metadata')
    assertSafeClimateDto(dto)
  })

  it('maps health DTO', () => {
    const dto = toClimateHealthDto({
      provider: 'open_meteo',
      ok: true,
      latency_ms: 120,
      checked_at: '2026-07-10T09:16:00.000Z',
    })
    expect(dto.ok).toBe(true)
    assertSafeClimateDto(dto)
  })
})
