import type {
  ClimateCurrentConditions,
  ClimateDataStatus,
  ClimateForecastSummary,
  ClimateHourlyPoint,
  ClimateLocationRecord,
  ClimateSnapshot,
  ClimateSystemHealth,
} from '../types/climate.types'
import {
  MODELLED_CONDITION_LABEL,
  SPATIAL_POINT_DISCLAIMER,
} from '../utils/location-labels'
import { formatLocalPresentation } from '../utils/timestamp'

export interface ClimateLocationDto {
  id: string
  name: string
  display_name: string
  location_type: string
  location_representation: string
  latitude: number
  longitude: number
  timezone: string
  spatial_disclaimer: string
}

export interface ClimateCurrentDto {
  model_time_utc: string
  model_time_local: string
  condition_label: string
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
  elevation: {
    registered_elevation_m: number | null
    provider_elevation_m: number | null
    elevation_difference_m: number | null
  }
}

export interface ClimateHourlyDto {
  timestamp_utc: string
  timestamp_local: string
  temporal_phase: string
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
  elevation: {
    registered_elevation_m: number | null
    provider_elevation_m: number | null
    elevation_difference_m: number | null
  }
  completeness_pct: number
  stale: boolean
  warnings: string[]
}

export interface ClimateDataStatusDto {
  provider: string
  model: string | null
  fetched_at: string | null
  issued_at: string | null
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
  provider_reachable: boolean
  provider_latency_ms: number | null
  database_reachable: boolean
  last_fetch_status: string | null
  last_success_at: string | null
  stale_locations_count: number
  locations_total: number
  locations_fresh: number
  consecutive_failures: number
  checked_at: string
}

function mapLocation(location: ClimateLocationRecord): ClimateLocationDto {
  return {
    id: location.id,
    name: location.name,
    display_name: location.display_name,
    location_type: location.location_type,
    location_representation: location.location_representation,
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: location.timezone,
    spatial_disclaimer: SPATIAL_POINT_DISCLAIMER,
  }
}

function mapCurrent(
  current: ClimateCurrentConditions | null,
  timezone: string,
): ClimateCurrentDto | null {
  if (!current) return null
  return {
    model_time_utc: current.model_time_utc,
    model_time_local: formatLocalPresentation(current.model_time_utc, timezone),
    condition_label: MODELLED_CONDITION_LABEL,
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
    elevation: {
      registered_elevation_m: current.registered_elevation_m ?? null,
      provider_elevation_m: current.provider_elevation_m ?? null,
      elevation_difference_m: current.elevation_difference_m ?? null,
    },
  }
}

function mapHourly(points: ClimateHourlyPoint[], timezone: string): ClimateHourlyDto[] {
  return points.map((p) => ({
    timestamp_utc: p.timestamp_utc,
    timestamp_local: formatLocalPresentation(p.timestamp_utc, timezone),
    temporal_phase: p.temporal_phase,
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
    issued_at: status.issued_at,
    next_refresh_at: status.next_refresh_at,
    is_stale: status.is_stale,
    quality: {
      provider: status.quality.provider,
      observed_or_modelled: status.quality.observed_or_modelled,
      spatial_resolution_km: status.quality.spatial_resolution_km ?? null,
      temporal_resolution_minutes: status.quality.temporal_resolution_minutes ?? null,
      elevation: status.quality.elevation,
      completeness_pct: status.quality.completeness_pct,
      stale: status.quality.stale,
      warnings: status.quality.warnings,
    },
  }
}

export function toClimateSnapshotDto(snapshot: ClimateSnapshot): ClimateSnapshotDto {
  return {
    location: mapLocation(snapshot.location),
    current: mapCurrent(snapshot.current, snapshot.location.timezone),
    forecast_summary: snapshot.forecast_summary,
    hourly: mapHourly(snapshot.hourly, snapshot.location.timezone),
    data_status: mapDataStatus(snapshot.data_status),
    generated_at: new Date().toISOString(),
  }
}

export function toClimateHealthDto(health: ClimateSystemHealth): ClimateHealthDto {
  return {
    provider: health.provider,
    provider_reachable: health.provider_reachable,
    provider_latency_ms: health.provider_latency_ms,
    database_reachable: health.database_reachable,
    last_fetch_status: health.last_fetch_status,
    last_success_at: health.last_success_at,
    stale_locations_count: health.stale_locations_count,
    locations_total: health.locations_total,
    locations_fresh: health.locations_fresh,
    consecutive_failures: health.consecutive_failures,
    checked_at: health.checked_at,
  }
}

export function assertSafeClimateDto(payload: unknown): void {
  const text = JSON.stringify(payload)
  const forbidden = ['source_metadata', 'service_role', 'SUPABASE_', 'api.open-meteo', 'stack']
  for (const token of forbidden) {
    if (text.includes(token)) {
      throw new Error(`DTO climático inseguro: contiene "${token}"`)
    }
  }
}
