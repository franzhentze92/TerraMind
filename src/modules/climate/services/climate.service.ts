import { CLIMATE_CONFIG } from '../config/climate.config'
import { createClimateProvider } from '../providers/open-meteo/open-meteo.provider'
import {
  completeFetchRun,
  createFetchRun,
  getClimateLocationById,
  getLatestFetchRun,
  getLatestObservation,
  listActiveClimateLocations,
  listForecastHourly,
  listTerritorialCentroids,
  observationFromRow,
  upsertClimateLocation,
  upsertForecasts,
  upsertObservation,
} from '../stores/climate.store'
import type { ClimateProvider } from '../types/climate-provider.interface'
import type {
  ClimateCurrentConditions,
  ClimateDataQuality,
  ClimateDataStatus,
  ClimateHourlyPoint,
  ClimateLocation,
  ClimateLocationRecord,
  ClimateProviderHealth,
  ClimateSnapshot,
  RegisterClimateLocationInput,
} from '../types/climate.types'
import { buildForecastSummary, completenessPct } from '../utils/derived-metrics'
import {
  buildCountryLocationKey,
  buildDepartmentLocationKey,
} from '../utils/location-key'
import {
  fetchOpenMeteoCurrentAndHourly,
} from '../providers/open-meteo/open-meteo.client'
import {
  mapOpenMeteoCurrent,
  mapOpenMeteoHourly,
  openMeteoSourceMetadata,
} from '../providers/open-meteo/open-meteo.mapper'

function minutesAgo(iso: string | null, minutes: number): boolean {
  if (!iso) return true
  const ageMs = Date.now() - new Date(iso).getTime()
  return ageMs > minutes * 60_000
}

function addMinutes(iso: string | null, minutes: number): string | null {
  if (!iso) return null
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}

function toClimateLocation(record: ClimateLocationRecord): ClimateLocation {
  return {
    latitude: record.latitude,
    longitude: record.longitude,
    elevation_m: record.elevation_m,
    timezone: record.timezone,
  }
}

function buildDataQuality(
  provider: ClimateCurrentConditions['provider'],
  hourly: ClimateHourlyPoint[],
  stale: boolean,
  elevationDiff?: number | null,
): ClimateDataQuality {
  const warnings: string[] = [
    'Datos modelados por Open-Meteo; no constituyen medición oficial de Guatemala.',
  ]
  if (stale) warnings.push('Snapshot fuera de ventana de frescura configurada.')

  return {
    provider,
    observed_or_modelled: 'modelled',
    spatial_resolution_km: 11,
    temporal_resolution_minutes: 60,
    elevation_difference_m: elevationDiff ?? null,
    completeness_pct: completenessPct(hourly, [
      'temperature_c',
      'relative_humidity_pct',
      'precipitation_mm',
      'wind_speed_10m_kph',
    ]),
    stale,
    warnings,
  }
}

export class ClimateService {
  constructor(private readonly provider: ClimateProvider = createClimateProvider()) {}

  async registerLocation(input: RegisterClimateLocationInput): Promise<ClimateLocationRecord> {
    return upsertClimateLocation(input)
  }

  async registerNationalLocations(): Promise<ClimateLocationRecord[]> {
    const centroids = await listTerritorialCentroids()
    const registered: ClimateLocationRecord[] = []

    for (const c of centroids) {
      if (c.entity_type === 'geo_countries') {
        registered.push(
          await this.registerLocation({
            location_key: buildCountryLocationKey(c.entity_id),
            name: c.name,
            latitude: c.latitude,
            longitude: c.longitude,
            timezone: CLIMATE_CONFIG.defaultTimezone,
            location_type: 'country',
            related_entity_type: c.entity_type,
            related_entity_id: c.entity_id,
          }),
        )
        continue
      }

      if (c.entity_type === 'geo_departments') {
        const [countryCode, deptCode] = c.entity_id.split(':')
        registered.push(
          await this.registerLocation({
            location_key: buildDepartmentLocationKey(countryCode, deptCode),
            name: c.name,
            latitude: c.latitude,
            longitude: c.longitude,
            timezone: CLIMATE_CONFIG.defaultTimezone,
            location_type: 'department',
            related_entity_type: c.entity_type,
            related_entity_id: c.entity_id,
          }),
        )
      }
    }

    return registered
  }

  async refreshLocation(locationId: string): Promise<ClimateSnapshot> {
    const location = await getClimateLocationById(locationId)
    if (!location) throw new Error(`Ubicación no encontrada: ${locationId}`)

    const started = Date.now()
    const runId = await createFetchRun(this.provider.id)

    try {
      const climateLocation = toClimateLocation(location)
      const response = await fetchOpenMeteoCurrentAndHourly(
        climateLocation,
        CLIMATE_CONFIG.forecastHours,
      )
      const fetchedAt = new Date().toISOString()
      const current = mapOpenMeteoCurrent(response, fetchedAt)
      const hourly = mapOpenMeteoHourly(response, CLIMATE_CONFIG.forecastHours)
      const metadata = openMeteoSourceMetadata(response)

      if (current) {
        await upsertObservation(location.id, current, {}, metadata)
      }
      const issuedAt = fetchedAt
      await upsertForecasts(
        location.id,
        this.provider.id,
        current?.model ?? 'open-meteo-forecast',
        issuedAt,
        hourly,
        metadata,
      )

      await completeFetchRun(runId, {
        status: 'success',
        locations_requested: 1,
        locations_success: 1,
        locations_failed: 0,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - started,
        metrics: { location_id: location.id, hourly_points: hourly.length },
      })

      return this.buildSnapshot(location, current, hourly, fetchedAt, false)
    } catch (err) {
      await completeFetchRun(runId, {
        status: 'failed',
        locations_requested: 1,
        locations_success: 0,
        locations_failed: 1,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - started,
        error_code: 'REFRESH_FAILED',
        error_message_safe: err instanceof Error ? err.message.slice(0, 240) : 'Error desconocido',
      })
      throw err
    }
  }

  async refreshAllActiveLocations(): Promise<{
    requested: number
    success: number
    failed: number
    duration_ms: number
    failures: Array<{ location_id: string; name: string; error: string }>
  }> {
    const locations = await listActiveClimateLocations()
    const started = Date.now()
    const runId = await createFetchRun(this.provider.id)
    const failures: Array<{ location_id: string; name: string; error: string }> = []
    let success = 0

    for (const location of locations) {
      try {
        await this.refreshLocation(location.id)
        success += 1
      } catch (err) {
        failures.push({
          location_id: location.id,
          name: location.name,
          error: err instanceof Error ? err.message : 'Error',
        })
      }
    }

    await completeFetchRun(runId, {
      status: failures.length ? 'partial' : 'success',
      locations_requested: locations.length,
      locations_success: success,
      locations_failed: failures.length,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      metrics: { failures: failures.length },
      error_message_safe: failures.length ? `${failures.length} ubicaciones fallaron` : null,
    })

    return {
      requested: locations.length,
      success,
      failed: failures.length,
      duration_ms: Date.now() - started,
      failures,
    }
  }

  async getLocationSnapshot(locationId: string, forceRefresh = false): Promise<ClimateSnapshot> {
    const location = await getClimateLocationById(locationId)
    if (!location) throw new Error(`Ubicación no encontrada: ${locationId}`)

    const latestObs = await getLatestObservation(location.id, this.provider.id)
    const forecast = await listForecastHourly(
      location.id,
      this.provider.id,
      CLIMATE_CONFIG.forecastHours,
    )

    const currentStale = minutesAgo(latestObs?.fetched_at ?? null, CLIMATE_CONFIG.currentTtlMinutes)
    const forecastStale = minutesAgo(forecast.fetched_at, CLIMATE_CONFIG.forecastTtlMinutes)

    if (forceRefresh || currentStale || forecastStale || !latestObs || forecast.points.length === 0) {
      return this.refreshLocation(locationId)
    }

    const current = latestObs ? observationFromRow(latestObs.row) : null
    return this.buildSnapshot(location, current, forecast.points, forecast.fetched_at, false)
  }

  async getForecast(locationId: string, hours: number): Promise<ClimateHourlyPoint[]> {
    const snapshot = await this.getLocationSnapshot(locationId)
    return snapshot.hourly.slice(0, hours)
  }

  async getProviderHealth(): Promise<ClimateProviderHealth> {
    return this.provider.healthCheck()
  }

  async getStatusSummary() {
    const locations = await listActiveClimateLocations()
    const latestRun = await getLatestFetchRun(this.provider.id)
    const health = await this.getProviderHealth()
    return {
      provider: this.provider.id,
      active_locations: locations.length,
      locations: locations.map((l) => ({
        id: l.id,
        name: l.name,
        location_type: l.location_type,
        location_key: l.location_key,
      })),
      latest_fetch_run: latestRun,
      health,
      config: {
        current_ttl_minutes: CLIMATE_CONFIG.currentTtlMinutes,
        forecast_ttl_minutes: CLIMATE_CONFIG.forecastTtlMinutes,
        forecast_hours: CLIMATE_CONFIG.forecastHours,
      },
    }
  }

  private buildSnapshot(
    location: ClimateLocationRecord,
    current: ClimateCurrentConditions | null,
    hourly: ClimateHourlyPoint[],
    fetchedAt: string | null,
    stale: boolean,
  ): ClimateSnapshot {
    const dataStatus: ClimateDataStatus = {
      provider: this.provider.id,
      model: current?.model ?? 'open-meteo-forecast',
      fetched_at: fetchedAt,
      next_refresh_at: addMinutes(fetchedAt, CLIMATE_CONFIG.forecastTtlMinutes),
      is_stale: stale,
      quality: buildDataQuality(this.provider.id, hourly, stale),
    }

    return {
      location,
      current,
      forecast_summary: buildForecastSummary(
        hourly,
        current,
        CLIMATE_CONFIG.rainProbabilityThresholdPct,
      ),
      hourly,
      data_status: dataStatus,
    }
  }
}

export const climateService = new ClimateService()
