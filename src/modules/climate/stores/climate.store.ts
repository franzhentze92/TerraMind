import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import type {
  ClimateCurrentConditions,
  ClimateHourlyPoint,
  ClimateLocationRecord,
  RegisterClimateLocationInput,
} from '../types/climate.types'

function mapLocationRow(row: Record<string, unknown>): ClimateLocationRecord {
  return {
    id: String(row.id),
    location_key: String(row.location_key),
    name: String(row.name),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    elevation_m: row.elevation_m === null || row.elevation_m === undefined ? null : Number(row.elevation_m),
    timezone: String(row.timezone),
    location_type: row.location_type as ClimateLocationRecord['location_type'],
    related_entity_type: row.related_entity_type ? String(row.related_entity_type) : null,
    related_entity_id: row.related_entity_id ? String(row.related_entity_id) : null,
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export async function upsertClimateLocation(
  input: RegisterClimateLocationInput,
): Promise<ClimateLocationRecord> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('climate_locations')
    .upsert(
      {
        location_key: input.location_key,
        name: input.name,
        latitude: input.latitude,
        longitude: input.longitude,
        elevation_m: input.elevation_m ?? null,
        timezone: input.timezone ?? 'America/Guatemala',
        location_type: input.location_type,
        related_entity_type: input.related_entity_type ?? null,
        related_entity_id: input.related_entity_id ?? null,
        is_active: true,
      },
      { onConflict: 'location_key' },
    )
    .select('*')
    .single()

  if (error) throw new Error(`climate_locations upsert: ${error.message}`)
  return mapLocationRow(data as Record<string, unknown>)
}

export async function getClimateLocationById(id: string): Promise<ClimateLocationRecord | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('climate_locations')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`climate_locations get: ${error.message}`)
  return data ? mapLocationRow(data as Record<string, unknown>) : null
}

export async function listActiveClimateLocations(): Promise<ClimateLocationRecord[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('climate_locations')
    .select('*')
    .eq('is_active', true)
    .order('name')
  if (error) throw new Error(`climate_locations list: ${error.message}`)
  return (data ?? []).map((row) => mapLocationRow(row as Record<string, unknown>))
}

export async function getLatestObservation(
  locationId: string,
  provider: string,
): Promise<{ row: Record<string, unknown>; fetched_at: string } | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('climate_observations')
    .select('*')
    .eq('location_id', locationId)
    .eq('provider', provider)
    .order('observed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`climate_observations latest: ${error.message}`)
  if (!data) return null
  return { row: data as Record<string, unknown>, fetched_at: String(data.fetched_at) }
}

export async function upsertObservation(
  locationId: string,
  current: ClimateCurrentConditions,
  optionalVariables: Record<string, unknown>,
  sourceMetadata: Record<string, unknown>,
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('climate_observations').upsert(
    {
      location_id: locationId,
      provider: current.provider,
      model: current.model ?? null,
      observed_at: current.observed_at,
      fetched_at: current.source_timestamp,
      temperature_c: current.temperature_c,
      relative_humidity_pct: current.relative_humidity_pct,
      precipitation_mm: current.precipitation_mm,
      rain_mm: current.rain_mm,
      wind_speed_10m_kph: current.wind_speed_10m_kph,
      wind_direction_10m_deg: current.wind_direction_10m_deg,
      wind_gusts_10m_kph: current.wind_gusts_10m_kph,
      cloud_cover_pct: current.cloud_cover_pct,
      surface_pressure_hpa: current.surface_pressure_hpa,
      optional_variables: {
        ...optionalVariables,
        soil_temperature_0cm_c: current.soil_temperature_0cm_c ?? null,
        soil_moisture_0_1cm: current.soil_moisture_0_1cm ?? null,
        weather_code: current.weather_code ?? null,
      },
      source_metadata: sourceMetadata,
    },
    { onConflict: 'location_id,provider,observed_at' },
  )
  if (error) throw new Error(`climate_observations upsert: ${error.message}`)
}

export async function upsertForecasts(
  locationId: string,
  provider: string,
  model: string | null,
  issuedAt: string,
  hourly: ClimateHourlyPoint[],
  sourceMetadata: Record<string, unknown>,
): Promise<number> {
  if (hourly.length === 0) return 0
  const supabase = getSupabaseAdmin()
  const fetchedAt = new Date().toISOString()
  const rows = hourly.map((point, index) => ({
    location_id: locationId,
    provider,
    model,
    issued_at: issuedAt,
    valid_at: point.timestamp,
    fetched_at: fetchedAt,
    horizon_hours: index + 1,
    temperature_c: point.temperature_c,
    relative_humidity_pct: point.relative_humidity_pct,
    precipitation_probability_pct: point.precipitation_probability_pct ?? null,
    precipitation_mm: point.precipitation_mm,
    rain_mm: point.rain_mm,
    wind_speed_10m_kph: point.wind_speed_10m_kph,
    wind_direction_10m_deg: point.wind_direction_10m_deg,
    wind_gusts_10m_kph: point.wind_gusts_10m_kph,
    cloud_cover_pct: point.cloud_cover_pct,
    optional_variables: {
      vapor_pressure_deficit_kpa: point.vapor_pressure_deficit_kpa ?? null,
    },
    source_metadata: sourceMetadata,
  }))

  const { error } = await supabase
    .from('climate_forecasts')
    .upsert(rows, { onConflict: 'location_id,provider,issued_at,valid_at' })
  if (error) throw new Error(`climate_forecasts upsert: ${error.message}`)
  return rows.length
}

export async function listForecastHourly(
  locationId: string,
  provider: string,
  hours: number,
): Promise<{ points: ClimateHourlyPoint[]; fetched_at: string | null; issued_at: string | null }> {
  const supabase = getSupabaseAdmin()
  const { data: latestRun, error: runError } = await supabase
    .from('climate_forecasts')
    .select('issued_at, fetched_at')
    .eq('location_id', locationId)
    .eq('provider', provider)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (runError) throw new Error(`climate_forecasts issued: ${runError.message}`)
  if (!latestRun) return { points: [], fetched_at: null, issued_at: null }

  const { data, error } = await supabase
    .from('climate_forecasts')
    .select('*')
    .eq('location_id', locationId)
    .eq('provider', provider)
    .eq('issued_at', latestRun.issued_at)
    .order('valid_at', { ascending: true })
    .limit(hours)
  if (error) throw new Error(`climate_forecasts list: ${error.message}`)

  const points: ClimateHourlyPoint[] = (data ?? []).map((row) => {
    const optional = (row.optional_variables ?? {}) as Record<string, unknown>
    return {
      timestamp: String(row.valid_at),
      temperature_c: row.temperature_c ?? null,
      relative_humidity_pct: row.relative_humidity_pct ?? null,
      precipitation_probability_pct: row.precipitation_probability_pct ?? null,
      precipitation_mm: row.precipitation_mm ?? null,
      rain_mm: row.rain_mm ?? null,
      wind_speed_10m_kph: row.wind_speed_10m_kph ?? null,
      wind_direction_10m_deg: row.wind_direction_10m_deg ?? null,
      wind_gusts_10m_kph: row.wind_gusts_10m_kph ?? null,
      cloud_cover_pct: row.cloud_cover_pct ?? null,
      vapor_pressure_deficit_kpa:
        optional.vapor_pressure_deficit_kpa === null || optional.vapor_pressure_deficit_kpa === undefined
          ? null
          : Number(optional.vapor_pressure_deficit_kpa),
    }
  })

  return {
    points,
    fetched_at: String(latestRun.fetched_at),
    issued_at: String(latestRun.issued_at),
  }
}

export interface ClimateFetchRunRecord {
  id: string
  provider: string
  status: string
  locations_requested: number
  locations_success: number
  locations_failed: number
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  metrics: Record<string, unknown>
  error_code: string | null
  error_message_safe: string | null
}

export async function createFetchRun(provider: string): Promise<string> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('climate_fetch_runs')
    .insert({ provider, status: 'running', started_at: new Date().toISOString() })
    .select('id')
    .single()
  if (error) throw new Error(`climate_fetch_runs create: ${error.message}`)
  return String(data.id)
}

export async function completeFetchRun(
  runId: string,
  patch: Partial<ClimateFetchRunRecord>,
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('climate_fetch_runs').update(patch).eq('id', runId)
  if (error) throw new Error(`climate_fetch_runs complete: ${error.message}`)
}

export async function getLatestFetchRun(provider: string): Promise<ClimateFetchRunRecord | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('climate_fetch_runs')
    .select('*')
    .eq('provider', provider)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`climate_fetch_runs latest: ${error.message}`)
  if (!data) return null
  return {
    id: String(data.id),
    provider: String(data.provider),
    status: String(data.status),
    locations_requested: Number(data.locations_requested),
    locations_success: Number(data.locations_success),
    locations_failed: Number(data.locations_failed),
    started_at: String(data.started_at),
    completed_at: data.completed_at ? String(data.completed_at) : null,
    duration_ms: data.duration_ms === null ? null : Number(data.duration_ms),
    metrics: (data.metrics ?? {}) as Record<string, unknown>,
    error_code: data.error_code ? String(data.error_code) : null,
    error_message_safe: data.error_message_safe ? String(data.error_message_safe) : null,
  }
}

export interface TerritorialCentroid {
  entity_type: string
  entity_id: string
  name: string
  latitude: number
  longitude: number
}

export async function listTerritorialCentroids(): Promise<TerritorialCentroid[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('geo_list_territorial_centroids')
  if (error) throw new Error(`geo_list_territorial_centroids: ${error.message}`)
  return (data ?? []).map((row: Record<string, unknown>) => ({
    entity_type: String(row.entity_type),
    entity_id: String(row.entity_id),
    name: String(row.name),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  }))
}

function mapObservationRow(row: Record<string, unknown>): ClimateCurrentConditions {
  const optional = (row.optional_variables ?? {}) as Record<string, unknown>
  return {
    observed_at: String(row.observed_at),
    temperature_c: row.temperature_c === null ? null : Number(row.temperature_c),
    relative_humidity_pct:
      row.relative_humidity_pct === null ? null : Number(row.relative_humidity_pct),
    precipitation_mm: row.precipitation_mm === null ? null : Number(row.precipitation_mm),
    rain_mm: row.rain_mm === null ? null : Number(row.rain_mm),
    wind_speed_10m_kph: row.wind_speed_10m_kph === null ? null : Number(row.wind_speed_10m_kph),
    wind_direction_10m_deg:
      row.wind_direction_10m_deg === null ? null : Number(row.wind_direction_10m_deg),
    wind_gusts_10m_kph: row.wind_gusts_10m_kph === null ? null : Number(row.wind_gusts_10m_kph),
    cloud_cover_pct: row.cloud_cover_pct === null ? null : Number(row.cloud_cover_pct),
    surface_pressure_hpa:
      row.surface_pressure_hpa === null ? null : Number(row.surface_pressure_hpa),
    soil_temperature_0cm_c:
      optional.soil_temperature_0cm_c === null || optional.soil_temperature_0cm_c === undefined
        ? null
        : Number(optional.soil_temperature_0cm_c),
    soil_moisture_0_1cm:
      optional.soil_moisture_0_1cm === null || optional.soil_moisture_0_1cm === undefined
        ? null
        : Number(optional.soil_moisture_0_1cm),
    weather_code:
      optional.weather_code === null || optional.weather_code === undefined
        ? null
        : Number(optional.weather_code),
    provider: row.provider as ClimateCurrentConditions['provider'],
    model: row.model ? String(row.model) : null,
    source_timestamp: String(row.fetched_at),
  }
}

export function observationFromRow(row: Record<string, unknown>): ClimateCurrentConditions {
  return mapObservationRow(row)
}
