import { degreesToCardinal, windTowardCardinal } from '@/modules/climate/utils/cardinal-direction'

export interface NumericAggregate {
  mean: number | null
  min: number | null
  max: number | null
}

export interface WindDirectionAggregate {
  degrees: number | null
  cardinal: string | null
  toward_cardinal: string | null
}

export interface EventConditionsAggregate {
  matched_time: string | null
  temperature_c: NumericAggregate
  relative_humidity_pct: NumericAggregate
  wind_speed_kmh: NumericAggregate
  wind_gust_kmh: NumericAggregate
  wind_direction: WindDirectionAggregate
  precipitation_mm: NumericAggregate
  cloud_cover_pct: NumericAggregate
}

function mean(values: number[]): number | null {
  if (!values.length) return null
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
}

function min(values: number[]): number | null {
  return values.length ? Math.min(...values) : null
}

function max(values: number[]): number | null {
  return values.length ? Math.max(...values) : null
}

function circularMeanDegrees(values: number[]): number | null {
  if (!values.length) return null
  let sinSum = 0
  let cosSum = 0
  for (const deg of values) {
    const rad = (deg * Math.PI) / 180
    sinSum += Math.sin(rad)
    cosSum += Math.cos(rad)
  }
  const meanRad = Math.atan2(sinSum / values.length, cosSum / values.length)
  const deg = ((meanRad * 180) / Math.PI + 360) % 360
  return Math.round(deg)
}

export function aggregateEventConditions(
  points: Array<{
    matchedTimestamp: string | null
    temperature_c: number | null
    relative_humidity_pct: number | null
    wind_speed_kmh: number | null
    wind_gust_kmh: number | null
    wind_direction_deg: number | null
    precipitation_mm: number | null
    cloud_cover_pct: number | null
  }>,
): EventConditionsAggregate {
  const temps = points.map((p) => p.temperature_c).filter((v): v is number => v != null)
  const humidity = points.map((p) => p.relative_humidity_pct).filter((v): v is number => v != null)
  const wind = points.map((p) => p.wind_speed_kmh).filter((v): v is number => v != null)
  const gusts = points.map((p) => p.wind_gust_kmh).filter((v): v is number => v != null)
  const dirs = points.map((p) => p.wind_direction_deg).filter((v): v is number => v != null)
  const precip = points.map((p) => p.precipitation_mm).filter((v): v is number => v != null)
  const clouds = points.map((p) => p.cloud_cover_pct).filter((v): v is number => v != null)

  const meanDir = circularMeanDegrees(dirs)
  const matchedTimes = points
    .map((p) => p.matchedTimestamp)
    .filter((v): v is string => Boolean(v))
    .sort()

  return {
    matched_time: matchedTimes[0] ?? null,
    temperature_c: { mean: mean(temps), min: min(temps), max: max(temps) },
    relative_humidity_pct: { mean: mean(humidity), min: min(humidity), max: max(humidity) },
    wind_speed_kmh: { mean: mean(wind), min: min(wind), max: max(wind) },
    wind_gust_kmh: { mean: mean(gusts), min: min(gusts), max: max(gusts) },
    wind_direction: {
      degrees: meanDir,
      cardinal: degreesToCardinal(meanDir),
      toward_cardinal: windTowardCardinal(meanDir),
    },
    precipitation_mm: { mean: mean(precip), min: min(precip), max: max(precip) },
    cloud_cover_pct: { mean: mean(clouds), min: min(clouds), max: max(clouds) },
  }
}

export function classifySpatialVariability(
  temperatureSpreadC: number | null,
  moderateThreshold: number,
  highThreshold: number,
): 'low' | 'moderate' | 'high' {
  if (temperatureSpreadC == null) return 'low'
  if (temperatureSpreadC >= highThreshold) return 'high'
  if (temperatureSpreadC >= moderateThreshold) return 'moderate'
  return 'low'
}

export function aggregateAntecedent(
  perPoint: Array<{
    precipitation_previous_24h_mm: number | null
    precipitation_previous_7d_mm: number | null
    precipitation_previous_30d_mm: number | null
    dry_days_consecutive: number | null
    max_temperature_previous_24h_c: number | null
    min_relative_humidity_previous_24h_pct: number | null
  }>,
) {
  const pickMean = (values: Array<number | null>) =>
    mean(values.filter((v): v is number => v != null))
  const pickMax = (values: Array<number | null>) =>
    max(values.filter((v): v is number => v != null))

  return {
    precipitation_previous_24h_mm: pickMean(perPoint.map((p) => p.precipitation_previous_24h_mm)),
    precipitation_previous_7d_mm: pickMean(perPoint.map((p) => p.precipitation_previous_7d_mm)),
    precipitation_previous_30d_mm: pickMean(perPoint.map((p) => p.precipitation_previous_30d_mm)),
    dry_days_consecutive: pickMax(perPoint.map((p) => p.dry_days_consecutive)),
    max_temperature_previous_24h_c: pickMax(
      perPoint.map((p) => p.max_temperature_previous_24h_c),
    ),
    min_relative_humidity_previous_24h_pct: min(
      perPoint.map((p) => p.min_relative_humidity_previous_24h_pct).filter((v): v is number => v != null),
    ),
  }
}

export function aggregateForecast(
  perPoint: Array<{
    available: boolean
    precipitation_next_24h_mm: number | null
    precipitation_next_72h_mm: number | null
    max_temperature_next_24h_c: number | null
    min_relative_humidity_next_24h_pct: number | null
    max_wind_speed_next_24h_kmh: number | null
    max_wind_gust_next_24h_kmh: number | null
  }>,
) {
  const available = perPoint.some((p) => p.available)
  const pickMean = (values: Array<number | null>) =>
    mean(values.filter((v): v is number => v != null))
  const pickMax = (values: Array<number | null>) =>
    max(values.filter((v): v is number => v != null))

  return {
    available,
    precipitation_next_24h_mm: pickMean(perPoint.map((p) => p.precipitation_next_24h_mm)),
    precipitation_next_72h_mm: pickMean(perPoint.map((p) => p.precipitation_next_72h_mm)),
    max_temperature_next_24h_c: pickMax(perPoint.map((p) => p.max_temperature_next_24h_c)),
    min_relative_humidity_next_24h_pct: min(
      perPoint
        .map((p) => p.min_relative_humidity_next_24h_pct)
        .filter((v): v is number => v != null),
    ),
    max_wind_speed_next_24h_kmh: pickMax(perPoint.map((p) => p.max_wind_speed_next_24h_kmh)),
    max_wind_gust_next_24h_kmh: pickMax(perPoint.map((p) => p.max_wind_gust_next_24h_kmh)),
  }
}
