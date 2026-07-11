export type ClimateLocationRepresentation =
  | 'point_reference'
  | 'station'
  | 'area_weighted'
  | 'grid_cell'

export type ClimateProviderId = 'open_meteo' | 'insivumeh' | 'chirps' | 'era5' | 'gpm'

export interface ClimateLocation {
  latitude: number
  longitude: number
  elevation_m?: number | null
  timezone: string
}

export interface ClimateCurrentConditions {
  /** Hora UTC del bloque modelado más reciente (no observación de estación). */
  model_time_utc: string
  temperature_c: number | null
  relative_humidity_pct: number | null
  precipitation_mm: number | null
  rain_mm: number | null
  wind_speed_10m_kph: number | null
  wind_direction_10m_deg: number | null
  wind_gusts_10m_kph: number | null
  cloud_cover_pct: number | null
  surface_pressure_hpa: number | null
  soil_temperature_0cm_c?: number | null
  soil_moisture_0_1cm?: number | null
  weather_code?: number | null
  provider: ClimateProviderId
  model?: string | null
  source_timestamp: string
  registered_elevation_m?: number | null
  provider_elevation_m?: number | null
  elevation_difference_m?: number | null
}

export interface ClimateHourlyPoint {
  /** Timestamp UTC ISO8601. */
  timestamp_utc: string
  temperature_c: number | null
  relative_humidity_pct: number | null
  precipitation_probability_pct?: number | null
  precipitation_mm: number | null
  rain_mm: number | null
  wind_speed_10m_kph: number | null
  wind_direction_10m_deg: number | null
  wind_gusts_10m_kph: number | null
  cloud_cover_pct: number | null
  vapor_pressure_deficit_kpa?: number | null
  temporal_phase: 'previous' | 'current' | 'forecast'
}

export interface ClimateDailyPoint {
  date: string
  temperature_max_c: number | null
  temperature_min_c: number | null
  precipitation_mm: number | null
  rain_mm: number | null
  wind_speed_max_kph: number | null
  weather_code?: number | null
}

export interface ClimateElevationInfo {
  registered_elevation_m: number | null
  provider_elevation_m: number | null
  elevation_difference_m: number | null
}

export interface ClimateDataQuality {
  provider: ClimateProviderId
  observed_or_modelled: 'observed' | 'modelled' | 'reanalysis' | 'satellite'
  spatial_resolution_km?: number | null
  temporal_resolution_minutes?: number | null
  elevation: ClimateElevationInfo
  completeness_pct: number
  stale: boolean
  warnings: string[]
}

export interface ClimateDataStatus {
  provider: ClimateProviderId
  model?: string | null
  fetched_at: string | null
  issued_at: string | null
  next_refresh_at: string | null
  is_stale: boolean
  quality: ClimateDataQuality
}

export interface ClimatePrecipitationSummary {
  precipitation_previous_24h_mm: number | null
  precipitation_previous_72h_mm: number | null
  precipitation_forecast_next_24h_mm: number | null
  precipitation_forecast_next_72h_mm: number | null
  precipitation_previous_source: 'modelled_hourly' | 'unavailable'
}

export interface ClimateForecastSummary extends ClimatePrecipitationSummary {
  max_gust_24h_kph: number | null
  min_humidity_24h_pct: number | null
  max_temperature_24h_c: number | null
  hours_with_rain_probability_gte_threshold: number
  rain_probability_threshold_pct: number
  hours_without_forecast_rain: number
  wind_direction_cardinal: string | null
}

export interface ClimateLocationRecord {
  id: string
  location_key: string
  name: string
  display_name: string
  latitude: number
  longitude: number
  elevation_m: number | null
  timezone: string
  location_type: ClimateLocationType
  location_representation: ClimateLocationRepresentation
  related_entity_type: string | null
  related_entity_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ClimateSnapshot {
  location: ClimateLocationRecord
  current: ClimateCurrentConditions | null
  forecast_summary: ClimateForecastSummary
  hourly: ClimateHourlyPoint[]
  data_status: ClimateDataStatus
}

export interface ClimateProviderHealth {
  provider: ClimateProviderId
  ok: boolean
  latency_ms: number | null
  checked_at: string
  message?: string
}

export interface ClimateSystemHealth {
  provider: ClimateProviderId
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

export interface ClimateSnapshotTiming {
  location_ms: number
  observation_ms: number
  forecast_ms: number
  assemble_ms: number
  total_ms: number
}

export interface ClimateRefreshMetrics {
  requested: number
  success: number
  failed: number
  duration_ms: number
  requests_total: number
  requests_per_location: number
  max_concurrency: number
  execution_mode: 'batched_parallel'
  failures: Array<{ location_id: string; name: string; error: string }>
}

export interface RegisterClimateLocationInput {
  location_key: string
  name: string
  display_name: string
  latitude: number
  longitude: number
  elevation_m?: number | null
  timezone?: string
  location_type: ClimateLocationType
  location_representation?: ClimateLocationRepresentation
  related_entity_type?: string | null
  related_entity_id?: string | null
}

export type ClimateLocationType =
  | 'country'
  | 'department'
  | 'municipality'
  | 'station'
  | 'event'
  | 'water_body'
  | 'parcel'
  | 'custom'
