import type { ClimateCurrentConditions, ClimateForecastSummary, ClimateHourlyPoint } from '../types/climate.types'
import { degreesToCardinal } from './cardinal-direction'

function finiteOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  return value
}

function sumRain(points: ClimateHourlyPoint[], hours: number): number | null {
  const slice = points.slice(0, hours)
  if (slice.length === 0) return null
  let total = 0
  let hasValue = false
  for (const p of slice) {
    const rain = finiteOrNull(p.rain_mm) ?? finiteOrNull(p.precipitation_mm)
    if (rain !== null) {
      total += rain
      hasValue = true
    }
  }
  return hasValue ? Math.round(total * 100) / 100 : null
}

function minInWindow(
  points: ClimateHourlyPoint[],
  hours: number,
  pick: (p: ClimateHourlyPoint) => number | null | undefined,
): number | null {
  const values = points
    .slice(0, hours)
    .map(pick)
    .filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v))
  return values.length ? Math.min(...values) : null
}

function maxInWindow(
  points: ClimateHourlyPoint[],
  hours: number,
  pick: (p: ClimateHourlyPoint) => number | null | undefined,
): number | null {
  const values = points
    .slice(0, hours)
    .map(pick)
    .filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v))
  return values.length ? Math.max(...values) : null
}

export function countHoursWithRainProbability(
  points: ClimateHourlyPoint[],
  hours: number,
  thresholdPct: number,
): number {
  return points.slice(0, hours).filter((p) => {
    const prob = p.precipitation_probability_pct
    return prob !== null && prob !== undefined && prob >= thresholdPct
  }).length
}

export function countHoursWithoutForecastRain(points: ClimateHourlyPoint[], hours: number): number {
  return points.slice(0, hours).filter((p) => {
    const rain = finiteOrNull(p.rain_mm) ?? finiteOrNull(p.precipitation_mm) ?? 0
    const prob = p.precipitation_probability_pct
    const lowProb = prob === null || prob === undefined || prob < 20
    return rain <= 0 && lowProb
  }).length
}

export function buildForecastSummary(
  hourly: ClimateHourlyPoint[],
  current: ClimateCurrentConditions | null,
  rainProbabilityThresholdPct: number,
): ClimateForecastSummary {
  return {
    rain_accum_24h_mm: sumRain(hourly, 24),
    rain_accum_72h_mm: sumRain(hourly, 72),
    rain_accum_7d_mm: hourly.length >= 168 ? sumRain(hourly, 168) : null,
    max_gust_24h_kph: maxInWindow(hourly, 24, (p) => p.wind_gusts_10m_kph),
    min_humidity_24h_pct: minInWindow(hourly, 24, (p) => p.relative_humidity_pct),
    max_temperature_24h_c: maxInWindow(hourly, 24, (p) => p.temperature_c),
    hours_with_rain_probability_gte_threshold: countHoursWithRainProbability(
      hourly,
      24,
      rainProbabilityThresholdPct,
    ),
    rain_probability_threshold_pct: rainProbabilityThresholdPct,
    hours_without_forecast_rain: countHoursWithoutForecastRain(hourly, 24),
    wind_direction_cardinal: degreesToCardinal(current?.wind_direction_10m_deg),
  }
}

/** VPD (kPa) — ecuación de Magnus documentada en FAO-56 / literatura estándar. */
export function computeVaporPressureDeficitKpa(
  temperatureC: number,
  relativeHumidityPct: number,
): number | null {
  if (!Number.isFinite(temperatureC) || !Number.isFinite(relativeHumidityPct)) return null
  const es = 0.6108 * Math.exp((17.27 * temperatureC) / (temperatureC + 237.3))
  const ea = es * (relativeHumidityPct / 100)
  const vpd = es - ea
  return Number.isFinite(vpd) ? Math.round(vpd * 1000) / 1000 : null
}

export function completenessPct(
  points: ClimateHourlyPoint[],
  requiredFields: (keyof ClimateHourlyPoint)[],
): number {
  if (points.length === 0) return 0
  let filled = 0
  let total = points.length * requiredFields.length
  for (const p of points) {
    for (const field of requiredFields) {
      const v = p[field]
      if (v !== null && v !== undefined && (typeof v !== 'number' || Number.isFinite(v))) {
        filled += 1
      }
    }
  }
  return total === 0 ? 0 : Math.round((filled / total) * 100)
}
