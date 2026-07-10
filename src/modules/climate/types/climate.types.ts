/** Tipos normalizados internos — unidades documentadas en docs/CLIMATE-INTELLIGENCE-CORE.md */

export type ClimateProviderId = 'open_meteo' | 'insivumeh' | 'chirps' | 'era5' | 'gpm'

export type ClimateLocationType =
  | 'country'
  | 'department'
  | 'municipality'
  | 'station'
  | 'event'
  | 'water_body'
  | 'parcel'
  | 'custom'

export interface ClimateLocation {
  latitude: number
  longitude: number
  elevation_m?: number | null
  timezone: string
}

export interface ClimateCurrentConditions {
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
  soil_temperature_0cm_c?: number | null
  soil_moisture_0_1cm?: number | null
  weather_code?: number | null
  provider: ClimateProviderId
  model?: string | null
  source_timestamp: string
}

export interface ClimateHourlyPoint {
  timestamp: string
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

export interface ClimateDataQuality {
  provider: ClimateProviderId
  observed_or_modelled: 'observed' | 'modelled' | 'reanalysis' | 'satellite'
  spatial_resolution_km?: number | null
  temporal_resolution_minutes?: number | null
  elevation_difference_m?: number | null
  completeness_pct: number
  stale: boolean
  warnings: string[]
}

export interface ClimateDataStatus {
  provider: ClimateProviderId
  model?: string | null
  fetched_at: string | null
  next_refresh_at: string | null
  is_stale: boolean
  quality: ClimateDataQuality
}

export interface ClimateForecastSummary {
  rain_accum_24h_mm: number | null
  rain_accum_72h_mm: number | null
  rain_accum_7d_mm: number | null
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
  latitude: number
  longitude: number
  elevation_m: number | null
  timezone: string
  location_type: ClimateLocationType
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

export interface RegisterClimateLocationInput {
  location_key: string
  name: string
  latitude: number
  longitude: number
  elevation_m?: number | null
  timezone?: string
  location_type: ClimateLocationType
  related_entity_type?: string | null
  related_entity_id?: string | null
}
