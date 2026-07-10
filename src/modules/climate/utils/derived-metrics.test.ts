import { describe, expect, it } from 'vitest'
import { buildForecastSummary, selectForecastHours, selectPreviousHours } from './derived-metrics'
import type { ClimateHourlyPoint } from '../types/climate.types'

function hour(offsetHours: number, patch: Partial<ClimateHourlyPoint> = {}): ClimateHourlyPoint {
  const base = new Date('2026-07-10T12:00:00.000Z').getTime()
  return {
    timestamp_utc: new Date(base + offsetHours * 60 * 60 * 1000).toISOString(),
    temperature_c: 20,
    relative_humidity_pct: 70,
    precipitation_mm: offsetHours < 0 ? 1 : 0.5,
    rain_mm: offsetHours < 0 ? 0.8 : 0.4,
    wind_speed_10m_kph: 10,
    wind_direction_10m_deg: 180,
    wind_gusts_10m_kph: 20,
    cloud_cover_pct: 50,
    temporal_phase: offsetHours < 0 ? 'previous' : 'forecast',
    ...patch,
  }
}

describe('derived metrics precipitation windows', () => {
  const reference = '2026-07-10T12:00:00.000Z'
  const hourly = [
    ...Array.from({ length: 24 }, (_, i) => hour(-24 + i)),
    hour(0, { temporal_phase: 'current' }),
    ...Array.from({ length: 72 }, (_, i) => hour(i + 1)),
  ]

  it('separates previous and forecast precipitation', () => {
    const previous24 = selectPreviousHours(hourly, reference, 24)
    const forecast24 = selectForecastHours(hourly, reference, 24)
    expect(previous24.length).toBe(24)
    expect(forecast24.length).toBe(24)

    const summary = buildForecastSummary(
      hourly,
      {
        model_time_utc: reference,
        temperature_c: 20,
        relative_humidity_pct: 70,
        precipitation_mm: 0,
        rain_mm: 0,
        wind_speed_10m_kph: 0,
        wind_direction_10m_deg: 0,
        wind_gusts_10m_kph: 0,
        cloud_cover_pct: 0,
        surface_pressure_hpa: 900,
        provider: 'open_meteo',
        source_timestamp: reference,
      },
      50,
    )
    expect(summary.precipitation_previous_24h_mm).toBeGreaterThan(0)
    expect(summary.precipitation_forecast_next_24h_mm).toBeGreaterThan(0)
    expect(summary.precipitation_previous_source).toBe('modelled_hourly')
  })
})
