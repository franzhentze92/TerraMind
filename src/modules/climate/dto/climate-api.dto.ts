import type {
  ClimateCurrentConditions,
  ClimateDataStatus,
  ClimateForecastSummary,
  ClimateHourlyPoint,
  ClimateLocationRecord,
  ClimateProviderHealth,
  ClimateSnapshot,
} from '../types/climate.types'

export interface ClimateLocationDto {
  id: string
  name: string
  location_type: string
  latitude: number
  longitude: number
  timezone: string
}

export interface ClimateCurrentDto {
  observed_at: string
  temperature_c: number | null
  relative_humidity_pct: number | null
  precipitation_mm: number | null
  rain_mm: number | null
  wind_speed_10m_kph: number | null
  wind_direction_10m_deg: number | null
  wind_gusts_10m_kph: number | null
  cloud_cover_pct: number | null
  surface_pressure_hpa: number | null
  weather_code: number | null
}

export interface ClimateHourlyDto {
  timestamp: string
  temperature_c: number | null
  relative_humidity_pct: number | null
  precipitation_probability_pct: number | null
  precipitation_mm: number | null
  rain_mm: number | null
  wind_speed_10m_kph: number | null
  wind_direction_10m_deg: number | null
  wind_gusts_10m_kph: number | null
  cloud_cover_pct: number | null
}

export interface ClimateDataQualityDto {
  provider: string
  observed_or_modelled: string
  spatial_resolution_km: number | null
  temporal_resolution_minutes: number | null
  completeness_pct: number
  stale: boolean
  warnings: string[]
}

export interface ClimateDataStatusDto {
  provider: string
  model: string | null
  fetched_at: string | null
  next_refresh_at: string | null
  is_stale: boolean
  quality: ClimateDataQualityDto
}

export interface ClimateSnapshotDto {
  location: ClimateLocationDto
  current: ClimateCurrentDto | null
  forecast_summary: ClimateForecastSummary
  hourly: ClimateHourlyDto[]
  data_status: ClimateDataStatusDto
  generated_at: string
}

export interface ClimateHealthDto {
  provider: string
  ok: boolean
  latency_ms: number | null
  checked_at: string
  message?: string
}

function mapLocation(location: ClimateLocationRecord): ClimateLocationDto {
  return {
    id: location.id,
    name: location.name,
    location_type: location.location_type,
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: location.timezone,
  }
}

function mapCurrent(current: ClimateCurrentConditions | null): ClimateCurrentDto | null {
  if (!current) return null
  return {
    observed_at: current.observed_at,
    temperature_c: current.temperature_c,
    relative_humidity_pct: current.relative_humidity_pct,
    precipitation_mm: current.precipitation_mm,
    rain_mm: current.rain_mm,
    wind_speed_10m_kph: current.wind_speed_10m_kph,
    wind_direction_10m_deg: current.wind_direction_10m_deg,
    wind_gusts_10m_kph: current.wind_gusts_10m_kph,
    cloud_cover_pct: current.cloud_cover_pct,
    surface_pressure_hpa: current.surface_pressure_hpa,
    weather_code: current.weather_code ?? null,
  }
}

function mapHourly(points: ClimateHourlyPoint[]): ClimateHourlyDto[] {
  return points.map((p) => ({
    timestamp: p.timestamp,
    temperature_c: p.temperature_c,
    relative_humidity_pct: p.relative_humidity_pct,
    precipitation_probability_pct: p.precipitation_probability_pct ?? null,
    precipitation_mm: p.precipitation_mm,
    rain_mm: p.rain_mm,
    wind_speed_10m_kph: p.wind_speed_10m_kph,
    wind_direction_10m_deg: p.wind_direction_10m_deg,
    wind_gusts_10m_kph: p.wind_gusts_10m_kph,
    cloud_cover_pct: p.cloud_cover_pct,
  }))
}

function mapDataStatus(status: ClimateDataStatus): ClimateDataStatusDto {
  return {
    provider: status.provider,
    model: status.model ?? null,
    fetched_at: status.fetched_at,
    next_refresh_at: status.next_refresh_at,
    is_stale: status.is_stale,
    quality: {
      provider: status.quality.provider,
      observed_or_modelled: status.quality.observed_or_modelled,
      spatial_resolution_km: status.quality.spatial_resolution_km ?? null,
      temporal_resolution_minutes: status.quality.temporal_resolution_minutes ?? null,
      completeness_pct: status.quality.completeness_pct,
      stale: status.quality.stale,
      warnings: status.quality.warnings,
    },
  }
}

export function toClimateSnapshotDto(snapshot: ClimateSnapshot): ClimateSnapshotDto {
  return {
    location: mapLocation(snapshot.location),
    current: mapCurrent(snapshot.current),
    forecast_summary: snapshot.forecast_summary,
    hourly: mapHourly(snapshot.hourly),
    data_status: mapDataStatus(snapshot.data_status),
    generated_at: new Date().toISOString(),
  }
}

export function toClimateHealthDto(health: ClimateProviderHealth): ClimateHealthDto {
  return {
    provider: health.provider,
    ok: health.ok,
    latency_ms: health.latency_ms,
    checked_at: health.checked_at,
    message: health.message,
  }
}

/** Garantiza que el DTO no expone campos internos prohibidos. */
export function assertSafeClimateDto(payload: unknown): void {
  const text = JSON.stringify(payload)
  const forbidden = ['source_metadata', 'service_role', 'SUPABASE_', 'api.open-meteo', 'stack']
  for (const token of forbidden) {
    if (text.includes(token)) {
      throw new Error(`DTO climático inseguro: contiene "${token}"`)
    }
  }
}
