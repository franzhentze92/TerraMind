import type {
  ClimateCurrentConditions,
  ClimateDailyPoint,
  ClimateHourlyPoint,
} from '../../types/climate.types'
import type { OpenMeteoForecastResponse } from './open-meteo.types'

function at<T>(arr: T[] | undefined, index: number): T | null {
  if (!arr || index >= arr.length) return null
  const value = arr[index]
  return value === undefined ? null : value
}

function safeNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  return value
}

function toIsoLocal(timestamp: string): string {
  return timestamp.includes('T') ? timestamp : `${timestamp}T00:00:00`
}

export function mapOpenMeteoCurrent(
  response: OpenMeteoForecastResponse,
  fetchedAt: string,
): ClimateCurrentConditions | null {
  const current = response.current
  if (!current) return null

  return {
    observed_at: toIsoLocal(current.time),
    temperature_c: safeNumber(current.temperature_2m),
    relative_humidity_pct: safeNumber(current.relative_humidity_2m),
    precipitation_mm: safeNumber(current.precipitation),
    rain_mm: safeNumber(current.rain),
    wind_speed_10m_kph: safeNumber(current.wind_speed_10m),
    wind_direction_10m_deg: safeNumber(current.wind_direction_10m),
    wind_gusts_10m_kph: safeNumber(current.wind_gusts_10m),
    cloud_cover_pct: safeNumber(current.cloud_cover),
    surface_pressure_hpa: safeNumber(current.surface_pressure),
    soil_temperature_0cm_c: safeNumber(current.soil_temperature_0cm),
    soil_moisture_0_1cm: safeNumber(current.soil_moisture_0_to_1cm),
    weather_code: safeNumber(current.weather_code),
    provider: 'open_meteo',
    model: 'open-meteo-forecast',
    source_timestamp: fetchedAt,
  }
}

export function mapOpenMeteoHourly(
  response: OpenMeteoForecastResponse,
  maxHours?: number,
): ClimateHourlyPoint[] {
  const hourly = response.hourly
  if (!hourly?.time?.length) return []

  const limit = maxHours ? Math.min(maxHours, hourly.time.length) : hourly.time.length
  const points: ClimateHourlyPoint[] = []

  for (let i = 0; i < limit; i++) {
    points.push({
      timestamp: toIsoLocal(hourly.time[i]),
      temperature_c: safeNumber(at(hourly.temperature_2m, i)),
      relative_humidity_pct: safeNumber(at(hourly.relative_humidity_2m, i)),
      precipitation_probability_pct: safeNumber(at(hourly.precipitation_probability, i)),
      precipitation_mm: safeNumber(at(hourly.precipitation, i)),
      rain_mm: safeNumber(at(hourly.rain, i)),
      wind_speed_10m_kph: safeNumber(at(hourly.wind_speed_10m, i)),
      wind_direction_10m_deg: safeNumber(at(hourly.wind_direction_10m, i)),
      wind_gusts_10m_kph: safeNumber(at(hourly.wind_gusts_10m, i)),
      cloud_cover_pct: safeNumber(at(hourly.cloud_cover, i)),
      vapor_pressure_deficit_kpa: safeNumber(at(hourly.vapour_pressure_deficit, i)),
    })
  }

  return points
}

export function mapOpenMeteoDaily(response: OpenMeteoForecastResponse): ClimateDailyPoint[] {
  const daily = response.daily
  if (!daily?.time?.length) return []

  const points: ClimateDailyPoint[] = []
  for (let i = 0; i < daily.time.length; i++) {
    points.push({
      date: daily.time[i],
      temperature_max_c: at(daily.temperature_2m_max, i),
      temperature_min_c: at(daily.temperature_2m_min, i),
      precipitation_mm: at(daily.precipitation_sum, i),
      rain_mm: at(daily.rain_sum, i),
      wind_speed_max_kph: at(daily.wind_speed_10m_max, i),
      weather_code: at(daily.weather_code, i),
    })
  }
  return points
}

export function openMeteoSourceMetadata(response: OpenMeteoForecastResponse): Record<string, unknown> {
  return {
    generationtime_ms: response.generationtime_ms ?? null,
    utc_offset_seconds: response.utc_offset_seconds ?? null,
    timezone: response.timezone ?? null,
    timezone_abbreviation: response.timezone_abbreviation ?? null,
    elevation_m: response.elevation ?? null,
    latitude: response.latitude,
    longitude: response.longitude,
  }
}
