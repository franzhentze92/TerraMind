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
    display_name: 'Punto de referencia nacional — centroide geográfico de Guatemala',
    latitude: 15.5,
    longitude: -90.2,
    elevation_m: null,
    timezone: 'America/Guatemala',
    location_type: 'country',
    location_representation: 'point_reference',
    related_entity_type: 'geo_countries',
    related_entity_id: 'GT',
    is_active: true,
    created_at: '2026-07-10T00:00:00.000Z',
    updated_at: '2026-07-10T00:00:00.000Z',
  },
  current: {
    model_time_utc: '2026-07-10T09:15:00.000Z',
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
    registered_elevation_m: null,
    provider_elevation_m: 1500,
    elevation_difference_m: null,
  },
  forecast_summary: {
    precipitation_previous_24h_mm: 1.2,
    precipitation_previous_72h_mm: 2.4,
    precipitation_forecast_next_24h_mm: 3.4,
    precipitation_forecast_next_72h_mm: 8.1,
    precipitation_previous_source: 'modelled_hourly',
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
    issued_at: '2026-07-10T09:16:00.000Z',
    next_refresh_at: '2026-07-10T10:16:00.000Z',
    is_stale: false,
    quality: {
      provider: 'open_meteo',
      observed_or_modelled: 'modelled',
      spatial_resolution_km: 11,
      temporal_resolution_minutes: 60,
      elevation: {
        registered_elevation_m: null,
        provider_elevation_m: 1500,
        elevation_difference_m: null,
      },
      completeness_pct: 100,
      stale: false,
      warnings: ['Condición meteorológica modelada más reciente; no medición de estación local.'],
    },
  },
}

describe('climate-api.dto', () => {
  it('maps snapshot without internal fields and with spatial disclaimer', () => {
    const dto = toClimateSnapshotDto(snapshot)
    expect(dto.location.display_name).toContain('Punto de referencia nacional')
    expect(dto.location.spatial_disclaimer).toContain('punto geográfico de referencia')
    expect(dto.current?.condition_label).toContain('modelada')
    expect(JSON.stringify(dto)).not.toContain('source_metadata')
    assertSafeClimateDto(dto)
  })

  it('maps expanded health DTO', () => {
    const dto = toClimateHealthDto({
      provider: 'open_meteo',
      provider_reachable: true,
      provider_latency_ms: 120,
      database_reachable: true,
      last_fetch_status: 'success',
      last_success_at: '2026-07-10T09:16:00.000Z',
      stale_locations_count: 0,
      locations_total: 23,
      locations_fresh: 23,
      consecutive_failures: 0,
      checked_at: '2026-07-10T09:16:00.000Z',
    })
    expect(dto.database_reachable).toBe(true)
    assertSafeClimateDto(dto)
  })
})
