import type { ClimateLocation } from '@/modules/climate/types/climate.types'
import { CLIMATE_EVENT_CONFIG } from '@/modules/climate/config/climate-event.config'
import { mapOpenMeteoHourly } from '@/modules/climate/providers/open-meteo/open-meteo.mapper'
import {
  fetchOpenMeteoForecast,
  fetchOpenMeteoHistorical,
} from '@/modules/climate/providers/open-meteo/open-meteo.client'
import {
  aggregateAntecedent,
  aggregateEventConditions,
  aggregateForecast,
  classifySpatialVariability,
} from '@/modules/climate/services/climate-event-aggregation'
import type { ClimateRepresentativePoint } from '@/modules/climate/services/climate-event-point-selection'
import {
  computeAntecedentMetrics,
  computeForecastMetrics,
  matchClosestHourlyPoint,
} from '@/modules/climate/services/climate-event-temporal'
import type { ClimateHourlyPoint } from '@/modules/climate/types/climate.types'

const HOURLY_VARS = [
  'temperature_2m',
  'relative_humidity_2m',
  'precipitation_probability',
  'precipitation',
  'rain',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'cloud_cover',
].join(',')

interface HourlyCacheEntry {
  hourly: ClimateHourlyPoint[]
  expiresAt: number
}

const hourlyCache = new Map<string, HourlyCacheEntry>()

function roundCoord(value: number): number {
  const factor = 10 ** CLIMATE_EVENT_CONFIG.coordinateRoundDecimals
  return Math.round(value * factor) / factor
}

function buildCacheKey(lat: number, lon: number, startDate: string, endDate: string): string {
  return `${roundCoord(lat)}_${roundCoord(lon)}_${startDate}_${endDate}`
}

function toClimateLocation(lat: number, lon: number): ClimateLocation {
  return {
    latitude: lat,
    longitude: lon,
    timezone: CLIMATE_EVENT_CONFIG.timezone,
    elevation_m: null,
  }
}

function formatDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime())
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}

export async function fetchHourlySeriesForPoint(input: {
  lat: number
  lon: number
  referenceUtc: string
}): Promise<ClimateHourlyPoint[]> {
  const reference = new Date(input.referenceUtc)
  const now = Date.now()
  const daysSinceEvent = (now - reference.getTime()) / 86_400_000
  const antecedentDays = CLIMATE_EVENT_CONFIG.antecedentDays
  const forecastDays = Math.ceil(CLIMATE_EVENT_CONFIG.forecastHours / 24)

  const fromDate = formatDateUtc(addDays(reference, -antecedentDays))
  const toDate = formatDateUtc(addDays(reference, forecastDays))
  const cacheKey = buildCacheKey(input.lat, input.lon, fromDate, toDate)
  const cached = hourlyCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.hourly

  const location = toClimateLocation(input.lat, input.lon)
  let response

  if (daysSinceEvent <= 3) {
    const pastDays = Math.min(92, Math.ceil(antecedentDays + daysSinceEvent + 1))
    response = await fetchOpenMeteoForecast(location, {
      hourly: HOURLY_VARS,
      past_days: String(pastDays),
      forecast_hours: String(CLIMATE_EVENT_CONFIG.forecastHours),
    })
  } else {
    response = await fetchOpenMeteoHistorical(location, fromDate, toDate)
  }

  const hourly = mapOpenMeteoHourly(response)
  hourlyCache.set(cacheKey, {
    hourly,
    expiresAt: Date.now() + CLIMATE_EVENT_CONFIG.cacheTtlMinutes * 60_000,
  })
  return hourly
}

export type ClimateEventWarningCode =
  | 'temporal_match_outside_tolerance'
  | 'spatial_weather_variability'
  | 'provider_partial'
  | 'forecast_unavailable'
  | 'antecedent_window_incomplete'
  | 'centroid_fallback'
  | 'point_query_failed'

export interface ClimatePointAnalysis {
  point: ClimateRepresentativePoint
  matchedTimestamp: string | null
  temporalOffsetMinutes: number | null
  conditions: {
    temperature_c: number | null
    relative_humidity_pct: number | null
    precipitation_mm: number | null
    wind_speed_kmh: number | null
    wind_direction_deg: number | null
    wind_gust_kmh: number | null
    cloud_cover_pct: number | null
  }
  antecedent: ReturnType<typeof computeAntecedentMetrics>
  forecast: ReturnType<typeof computeForecastMetrics>
  warnings: ClimateEventWarningCode[]
}

export interface ClimateEventAnalysisResult {
  eventTimeStart: string
  eventTimeEnd: string
  pointAnalyses: ClimatePointAnalysis[]
  conditionsSummary: ReturnType<typeof aggregateEventConditions>
  antecedentSummary: ReturnType<typeof aggregateAntecedent>
  forecastSummary: ReturnType<typeof aggregateForecast>
  spatialVariability: { point_count: number; level: 'low' | 'moderate' | 'high' }
  warnings: ClimateEventWarningCode[]
  temporalAlignment: 'exact' | 'partial' | 'mismatch'
  metrics: {
    provider_request_ms: number
    aggregation_ms: number
    cache_hits: number
    cache_misses: number
  }
}

export async function analyzeClimateForEventPoints(
  points: ClimateRepresentativePoint[],
): Promise<ClimateEventAnalysisResult> {
  const started = Date.now()
  let providerMs = 0
  let cacheHits = 0
  let cacheMisses = 0
  const warnings: ClimateEventWarningCode[] = []
  const pointAnalyses: ClimatePointAnalysis[] = []

  const timestamps = points.map((p) => p.acquired_at_utc).sort()
  const eventTimeStart = timestamps[0] ?? new Date().toISOString()
  const eventTimeEnd = timestamps[timestamps.length - 1] ?? eventTimeStart

  for (const point of points) {
    const pointWarnings: ClimateEventWarningCode[] = []
    if (point.role === 'centroid_fallback') pointWarnings.push('centroid_fallback')

    const fetchStart = Date.now()
    const fromDate = formatDateUtc(addDays(new Date(point.acquired_at_utc), -CLIMATE_EVENT_CONFIG.antecedentDays))
    const toDate = formatDateUtc(
      addDays(new Date(point.acquired_at_utc), Math.ceil(CLIMATE_EVENT_CONFIG.forecastHours / 24)),
    )
    const cacheKey = buildCacheKey(point.lat, point.lon, fromDate, toDate)
    const hadCache = hourlyCache.has(cacheKey) && (hourlyCache.get(cacheKey)?.expiresAt ?? 0) > Date.now()

    let hourly: ClimateHourlyPoint[]
    try {
      hourly = await fetchHourlySeriesForPoint({
        lat: point.lat,
        lon: point.lon,
        referenceUtc: point.acquired_at_utc,
      })
    } catch {
      pointWarnings.push('point_query_failed')
      warnings.push('point_query_failed')
      continue
    }

    providerMs += Date.now() - fetchStart
    if (hadCache) cacheHits += 1
    else cacheMisses += 1

    const match = matchClosestHourlyPoint(
      hourly,
      point.acquired_at_utc,
      CLIMATE_EVENT_CONFIG.maxTimeOffsetMinutes,
    )
    if (match.outsideTolerance) {
      pointWarnings.push('temporal_match_outside_tolerance')
      warnings.push('temporal_match_outside_tolerance')
    }

    const referenceUtc = point.acquired_at_utc
    const antecedent = computeAntecedentMetrics(
      hourly,
      referenceUtc,
      CLIMATE_EVENT_CONFIG.dryDayThresholdMm,
      CLIMATE_EVENT_CONFIG.timezone,
    )
    if (antecedent.precipitation_previous_30d_mm == null) {
      pointWarnings.push('antecedent_window_incomplete')
    }

    const forecast = computeForecastMetrics(hourly, referenceUtc)
    if (!forecast.available) {
      pointWarnings.push('forecast_unavailable')
    }

    const matched = match.point
    pointAnalyses.push({
      point,
      matchedTimestamp: match.matchedTimestamp,
      temporalOffsetMinutes: match.offsetMinutes,
      conditions: {
        temperature_c: matched?.temperature_c ?? null,
        relative_humidity_pct: matched?.relative_humidity_pct ?? null,
        precipitation_mm: matched?.precipitation_mm ?? matched?.rain_mm ?? null,
        wind_speed_kmh: matched?.wind_speed_10m_kph ?? null,
        wind_direction_deg: matched?.wind_direction_10m_deg ?? null,
        wind_gust_kmh: matched?.wind_gusts_10m_kph ?? null,
        cloud_cover_pct: matched?.cloud_cover_pct ?? null,
      },
      antecedent,
      forecast,
      warnings: pointWarnings,
    })
  }

  if (pointAnalyses.length === 0) {
    throw new Error('No se pudo consultar clima para ningún punto')
  }

  const conditionsSummary = aggregateEventConditions(
    pointAnalyses.map((p) => ({
      matchedTimestamp: p.matchedTimestamp,
      temperature_c: p.conditions.temperature_c,
      relative_humidity_pct: p.conditions.relative_humidity_pct,
      wind_speed_kmh: p.conditions.wind_speed_kmh,
      wind_gust_kmh: p.conditions.wind_gust_kmh,
      wind_direction_deg: p.conditions.wind_direction_deg,
      precipitation_mm: p.conditions.precipitation_mm,
      cloud_cover_pct: p.conditions.cloud_cover_pct,
    })),
  )

  const antecedentSummary = aggregateAntecedent(pointAnalyses.map((p) => p.antecedent))
  const forecastSummary = aggregateForecast(pointAnalyses.map((p) => p.forecast))

  const tempSpread =
    conditionsSummary.temperature_c.max != null && conditionsSummary.temperature_c.min != null
      ? conditionsSummary.temperature_c.max - conditionsSummary.temperature_c.min
      : null

  const spatialLevel = classifySpatialVariability(
    tempSpread,
    CLIMATE_EVENT_CONFIG.spatialVariabilityModerateTempC,
    CLIMATE_EVENT_CONFIG.spatialVariabilityHighTempC,
  )
  if (spatialLevel !== 'low') warnings.push('spatial_weather_variability')

  if (!forecastSummary.available) warnings.push('forecast_unavailable')
  if (pointAnalyses.length < points.length) warnings.push('provider_partial')

  const uniqueWarnings = [...new Set(warnings)]
  let temporalAlignment: 'exact' | 'partial' | 'mismatch' = 'exact'
  if (uniqueWarnings.includes('temporal_match_outside_tolerance')) temporalAlignment = 'mismatch'
  else if (uniqueWarnings.includes('provider_partial')) temporalAlignment = 'partial'

  return {
    eventTimeStart,
    eventTimeEnd,
    pointAnalyses,
    conditionsSummary,
    antecedentSummary,
    forecastSummary,
    spatialVariability: { point_count: pointAnalyses.length, level: spatialLevel },
    warnings: uniqueWarnings,
    temporalAlignment,
    metrics: {
      provider_request_ms: providerMs,
      aggregation_ms: Date.now() - started - providerMs,
      cache_hits: cacheHits,
      cache_misses: cacheMisses,
    },
  }
}

export function clearClimateEventHourlyCache(): void {
  hourlyCache.clear()
}
