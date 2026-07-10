import { describe, expect, it } from 'vitest'
import {
  buildForecastSummary,
  computeVaporPressureDeficitKpa,
  countHoursWithRainProbability,
  countHoursWithoutForecastRain,
} from './derived-metrics'
import type { ClimateHourlyPoint } from '../types/climate.types'

function hour(i: number, patch: Partial<ClimateHourlyPoint> = {}): ClimateHourlyPoint {
  return {
    timestamp: `2026-07-10T${String(i).padStart(2, '0')}:00:00`,
    temperature_c: 20 + i * 0.1,
    relative_humidity_pct: 80 - i,
    precipitation_mm: i % 3 === 0 ? 0.5 : 0,
    rain_mm: i % 3 === 0 ? 0.4 : 0,
    wind_speed_10m_kph: 10,
    wind_direction_10m_deg: 180,
    wind_gusts_10m_kph: 20 + i,
    cloud_cover_pct: 50,
    precipitation_probability_pct: i % 2 === 0 ? 60 : 10,
    ...patch,
  }
}

describe('derived metrics', () => {
  const hourly = Array.from({ length: 72 }, (_, i) => hour(i))

  it('sums rain accumulations', () => {
    const summary = buildForecastSummary(hourly, null, 50)
    expect(summary.rain_accum_24h_mm).toBeGreaterThan(0)
    expect(summary.rain_accum_72h_mm).toBeGreaterThan(summary.rain_accum_24h_mm!)
    expect(summary.max_gust_24h_kph).toBe(43)
    expect(summary.min_humidity_24h_pct).toBe(57)
  })

  it('counts rain probability hours and dry hours', () => {
    expect(countHoursWithRainProbability(hourly, 24, 50)).toBe(12)
    expect(countHoursWithoutForecastRain(hourly, 24)).toBeGreaterThan(0)
  })

  it('computes VPD with Magnus formula', () => {
    const vpd = computeVaporPressureDeficitKpa(25, 50)
    expect(vpd).not.toBeNull()
    expect(vpd!).toBeGreaterThan(0)
    expect(vpd!).toBeLessThan(3)
  })
})
