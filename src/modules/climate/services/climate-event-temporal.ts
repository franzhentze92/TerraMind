import type { ClimateHourlyPoint } from '@/modules/climate/types/climate.types'
import { timestampToUtcMs } from '@/modules/climate/utils/timestamp'
import {
  selectForecastHours,
  selectPreviousHours,
} from '@/modules/climate/utils/derived-metrics'

export interface TemporalMatchResult {
  point: ClimateHourlyPoint | null
  matchedTimestamp: string | null
  offsetMinutes: number | null
  outsideTolerance: boolean
}

export function matchClosestHourlyPoint(
  hourly: ClimateHourlyPoint[],
  targetUtc: string,
  maxOffsetMinutes: number,
): TemporalMatchResult {
  const targetMs = timestampToUtcMs(targetUtc)
  let best: ClimateHourlyPoint | null = null
  let bestOffsetMs = Infinity

  for (const point of hourly) {
    const offsetMs = Math.abs(timestampToUtcMs(point.timestamp_utc) - targetMs)
    if (offsetMs < bestOffsetMs) {
      bestOffsetMs = offsetMs
      best = point
    }
  }

  if (!best) {
    return { point: null, matchedTimestamp: null, offsetMinutes: null, outsideTolerance: true }
  }

  const offsetMinutes = Math.round((bestOffsetMs / 60_000) * 10) / 10
  const outsideTolerance = offsetMinutes > maxOffsetMinutes
  return {
    point: best,
    matchedTimestamp: best.timestamp_utc,
    offsetMinutes,
    outsideTolerance,
  }
}

function rainMm(point: ClimateHourlyPoint): number {
  return point.rain_mm ?? point.precipitation_mm ?? 0
}

function sumPrecip(points: ClimateHourlyPoint[]): number | null {
  if (points.length === 0) return null
  let total = 0
  for (const p of points) total += rainMm(p)
  return Math.round(total * 100) / 100
}

function maxOf(points: ClimateHourlyPoint[], pick: (p: ClimateHourlyPoint) => number | null): number | null {
  const values = points
    .map(pick)
    .filter((v): v is number => v !== null && Number.isFinite(v))
  return values.length ? Math.max(...values) : null
}

function minOf(points: ClimateHourlyPoint[], pick: (p: ClimateHourlyPoint) => number | null): number | null {
  const values = points
    .map(pick)
    .filter((v): v is number => v !== null && Number.isFinite(v))
  return values.length ? Math.min(...values) : null
}

export interface AntecedentMetrics {
  precipitation_previous_24h_mm: number | null
  precipitation_previous_7d_mm: number | null
  precipitation_previous_30d_mm: number | null
  max_temperature_previous_24h_c: number | null
  min_relative_humidity_previous_24h_pct: number | null
  dry_days_consecutive: number | null
}

export interface ForecastMetrics {
  available: boolean
  precipitation_next_24h_mm: number | null
  precipitation_next_72h_mm: number | null
  max_temperature_next_24h_c: number | null
  min_relative_humidity_next_24h_pct: number | null
  max_wind_speed_next_24h_kmh: number | null
  max_wind_gust_next_24h_kmh: number | null
}

export function computeAntecedentMetrics(
  hourly: ClimateHourlyPoint[],
  referenceUtc: string,
  dryDayThresholdMm: number,
  timezone: string,
): AntecedentMetrics {
  const prev24 = selectPreviousHours(hourly, referenceUtc, 24)
  const prev7d = selectPreviousHours(hourly, referenceUtc, 24 * 7)
  const prev30d = selectPreviousHours(hourly, referenceUtc, 24 * 30)

  return {
    precipitation_previous_24h_mm: sumPrecip(prev24),
    precipitation_previous_7d_mm: prev7d.length >= 24 * 5 ? sumPrecip(prev7d) : null,
    precipitation_previous_30d_mm: prev30d.length >= 24 * 20 ? sumPrecip(prev30d) : null,
    max_temperature_previous_24h_c: maxOf(prev24, (p) => p.temperature_c),
    min_relative_humidity_previous_24h_pct: minOf(prev24, (p) => p.relative_humidity_pct),
    dry_days_consecutive: computeDryDaysConsecutive(hourly, referenceUtc, dryDayThresholdMm, timezone),
  }
}

export function computeForecastMetrics(
  hourly: ClimateHourlyPoint[],
  referenceUtc: string,
): ForecastMetrics {
  const next24 = selectForecastHours(hourly, referenceUtc, 24)
  const next72 = selectForecastHours(hourly, referenceUtc, 72)

  return {
    available: next24.length > 0,
    precipitation_next_24h_mm: sumPrecip(next24),
    precipitation_next_72h_mm: next72.length >= 48 ? sumPrecip(next72) : null,
    max_temperature_next_24h_c: maxOf(next24, (p) => p.temperature_c),
    min_relative_humidity_next_24h_pct: minOf(next24, (p) => p.relative_humidity_pct),
    max_wind_speed_next_24h_kmh: maxOf(next24, (p) => p.wind_speed_10m_kph),
    max_wind_gust_next_24h_kmh: maxOf(next24, (p) => p.wind_gusts_10m_kph),
  }
}

/** Días completos en zona horaria local con precipitación diaria < umbral. */
export function computeDryDaysConsecutive(
  hourly: ClimateHourlyPoint[],
  referenceUtc: string,
  thresholdMm: number,
  timezone: string,
): number | null {
  const dailyTotals = aggregateDailyPrecipitation(hourly, timezone)
  if (dailyTotals.length === 0) return null

  const eventLocalDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(referenceUtc))

  const dayMap = new Map(dailyTotals.map((d) => [d.date, d.precipitation_mm]))
  let count = 0
  let cursor = new Date(`${eventLocalDate}T12:00:00Z`)

  for (let i = 0; i < 45; i += 1) {
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000)
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(cursor)
    const total = dayMap.get(date)
    if (total === undefined) break
    if (total < thresholdMm) count += 1
    else break
  }

  return count
}

function aggregateDailyPrecipitation(
  hourly: ClimateHourlyPoint[],
  timezone: string,
): Array<{ date: string; precipitation_mm: number }> {
  const buckets = new Map<string, number>()
  for (const point of hourly) {
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(point.timestamp_utc))
    const rain = rainMm(point)
    buckets.set(date, (buckets.get(date) ?? 0) + rain)
  }
  return [...buckets.entries()]
    .map(([date, precipitation_mm]) => ({
      date,
      precipitation_mm: Math.round(precipitation_mm * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
