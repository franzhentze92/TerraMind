import type { ClimateCurrentConditions, ClimateForecastSummary, ClimateHourlyPoint } from '../types/climate.types'
import { degreesToCardinal } from './cardinal-direction'
import { timestampToUtcMs } from './timestamp'

function finiteOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  return value
}

function rainAmount(point: ClimateHourlyPoint): number | null {
  return finiteOrNull(point.rain_mm) ?? finiteOrNull(point.precipitation_mm)
}

function sumRainInWindow(points: ClimateHourlyPoint[]): number | null {
  if (points.length === 0) return null
  let total = 0
  let hasValue = false
  for (const p of points) {
    const rain = rainAmount(p)
    if (rain !== null) {
      total += rain
      hasValue = true
    }
  }
  return hasValue ? Math.round(total * 100) / 100 : null
}

function minInWindow(
  points: ClimateHourlyPoint[],
  pick: (p: ClimateHourlyPoint) => number | null | undefined,
): number | null {
  const values = points
    .map(pick)
    .filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v))
  return values.length ? Math.min(...values) : null
}

function maxInWindow(
  points: ClimateHourlyPoint[],
  pick: (p: ClimateHourlyPoint) => number | null | undefined,
): number | null {
  const values = points
    .map(pick)
    .filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v))
  return values.length ? Math.max(...values) : null
}

export function classifyHourlyTemporalPhase(
  pointUtcMs: number,
  referenceUtcMs: number,
): ClimateHourlyPoint['temporal_phase'] {
  const hourMs = 60 * 60 * 1000
  if (pointUtcMs < referenceUtcMs - hourMs / 2) return 'previous'
  if (pointUtcMs > referenceUtcMs + hourMs / 2) return 'forecast'
  return 'current'
}

export function annotateHourlyTemporalPhases(
  hourly: ClimateHourlyPoint[],
  referenceUtcIso: string,
): ClimateHourlyPoint[] {
  const referenceMs = timestampToUtcMs(referenceUtcIso)
  return hourly.map((point) => ({
    ...point,
    temporal_phase: classifyHourlyTemporalPhase(timestampToUtcMs(point.timestamp_utc), referenceMs),
  }))
}

export function selectPreviousHours(
  hourly: ClimateHourlyPoint[],
  referenceUtcIso: string,
  hours: number,
): ClimateHourlyPoint[] {
  const referenceMs = timestampToUtcMs(referenceUtcIso)
  const minMs = referenceMs - hours * 60 * 60 * 1000
  return hourly.filter((p) => {
    const ts = timestampToUtcMs(p.timestamp_utc)
    return ts >= minMs && ts < referenceMs
  })
}

export function selectForecastHours(
  hourly: ClimateHourlyPoint[],
  referenceUtcIso: string,
  hours: number,
): ClimateHourlyPoint[] {
  const referenceMs = timestampToUtcMs(referenceUtcIso)
  const maxMs = referenceMs + hours * 60 * 60 * 1000
  return hourly.filter((p) => {
    const ts = timestampToUtcMs(p.timestamp_utc)
    return ts > referenceMs && ts <= maxMs
  })
}

export function countHoursWithRainProbability(
  points: ClimateHourlyPoint[],
  thresholdPct: number,
): number {
  return points.filter((p) => {
    const prob = p.precipitation_probability_pct
    return prob !== null && prob !== undefined && prob >= thresholdPct
  }).length
}

export function countHoursWithoutForecastRain(points: ClimateHourlyPoint[]): number {
  return points.filter((p) => {
    const rain = rainAmount(p) ?? 0
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
  const referenceUtc = current?.model_time_utc ?? hourly[0]?.timestamp_utc ?? new Date().toISOString()
  const previous24 = selectPreviousHours(hourly, referenceUtc, 24)
  const previous72 = selectPreviousHours(hourly, referenceUtc, 72)
  const forecast24 = selectForecastHours(hourly, referenceUtc, 24)
  const forecast72 = selectForecastHours(hourly, referenceUtc, 72)

  return {
    precipitation_previous_24h_mm: sumRainInWindow(previous24),
    precipitation_previous_72h_mm: previous72.length >= 48 ? sumRainInWindow(previous72) : null,
    precipitation_forecast_next_24h_mm: sumRainInWindow(forecast24),
    precipitation_forecast_next_72h_mm: sumRainInWindow(forecast72),
    precipitation_previous_source: previous24.length > 0 ? 'modelled_hourly' : 'unavailable',
    max_gust_24h_kph: maxInWindow(forecast24, (p) => p.wind_gusts_10m_kph),
    min_humidity_24h_pct: minInWindow(forecast24, (p) => p.relative_humidity_pct),
    max_temperature_24h_c: maxInWindow(forecast24, (p) => p.temperature_c),
    hours_with_rain_probability_gte_threshold: countHoursWithRainProbability(
      forecast24,
      rainProbabilityThresholdPct,
    ),
    rain_probability_threshold_pct: rainProbabilityThresholdPct,
    hours_without_forecast_rain: countHoursWithoutForecastRain(forecast24),
    wind_direction_cardinal: degreesToCardinal(current?.wind_direction_10m_deg),
  }
}

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
  const total = points.length * requiredFields.length
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

export function computeElevationDifference(
  registered: number | null | undefined,
  provider: number | null | undefined,
): number | null {
  if (registered === null || registered === undefined || provider === null || provider === undefined) {
    return null
  }
  if (!Number.isFinite(registered) || !Number.isFinite(provider)) return null
  return Math.round(Math.abs(registered - provider) * 10) / 10
}
