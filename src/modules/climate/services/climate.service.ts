import { CLIMATE_CONFIG } from '../config/climate.config'
import { createClimateProvider } from '../providers/open-meteo/open-meteo.provider'
import {
  checkDatabaseReachable,
  completeFetchRun,
  countConsecutiveFailures,
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
  ClimateRefreshMetrics,
  ClimateSnapshot,
  ClimateSnapshotTiming,
  ClimateSystemHealth,
  RegisterClimateLocationInput,
} from '../types/climate.types'
import { mapWithConcurrency } from '../utils/concurrency'
import {
  annotateHourlyTemporalPhases,
  buildForecastSummary,
  completenessPct,
} from '../utils/derived-metrics'
import {
  buildCountryLocationKey,
  buildDepartmentLocationKey,
} from '../utils/location-key'
import { buildPointReferenceDisplayName, SPATIAL_POINT_DISCLAIMER } from '../utils/location-labels'
import { formatLocalPresentation } from '../utils/timestamp'
import { fetchOpenMeteoCurrentAndHourly } from '../providers/open-meteo/open-meteo.client'
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

function maxHourlyPoints(): number {
  return CLIMATE_CONFIG.pastDays * 24 + CLIMATE_CONFIG.forecastHours + 4
}

function buildDataQuality(
  current: ClimateCurrentConditions | null,
  hourly: ClimateHourlyPoint[],
  stale: boolean,
): ClimateDataQuality {
  const warnings: string[] = [
    SPATIAL_POINT_DISCLAIMER,
    'Condición meteorológica modelada más reciente; no medición de estación local.',
    'Datos de Open-Meteo; no constituyen fuente oficial de Guatemala.',
  ]
  if (stale) warnings.push('Snapshot fuera de ventana de frescura configurada.')

  const elevationDiff = current?.elevation_difference_m ?? null
  if (
    elevationDiff !== null &&
    elevationDiff > CLIMATE_CONFIG.elevationWarningThresholdM
  ) {
    warnings.push(
      `Diferencia de elevación registrada vs modelo (${elevationDiff} m) supera umbral de ${CLIMATE_CONFIG.elevationWarningThresholdM} m.`,
    )
  }

  return {
    provider: current?.provider ?? CLIMATE_CONFIG.provider,
    observed_or_modelled: 'modelled',
    spatial_resolution_km: 11,
    temporal_resolution_minutes: 60,
    elevation: {
      registered_elevation_m: current?.registered_elevation_m ?? null,
      provider_elevation_m: current?.provider_elevation_m ?? null,
      elevation_difference_m: elevationDiff,
    },
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
            display_name: buildPointReferenceDisplayName('country', c.name),
            latitude: c.latitude,
            longitude: c.longitude,
            timezone: CLIMATE_CONFIG.defaultTimezone,
            location_type: 'country',
            location_representation: 'point_reference',
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
            display_name: buildPointReferenceDisplayName('department', c.name),
            latitude: c.latitude,
            longitude: c.longitude,
            timezone: CLIMATE_CONFIG.defaultTimezone,
            location_type: 'department',
            location_representation: 'point_reference',
            related_entity_type: c.entity_type,
            related_entity_id: c.entity_id,
          }),
        )
      }
    }

    return registered
  }

  async refreshLocation(locationId: string, options?: { logRun?: boolean }): Promise<ClimateSnapshot> {
    const location = await getClimateLocationById(locationId)
    if (!location) throw new Error(`Ubicación no encontrada: ${locationId}`)

    const logRun = options?.logRun ?? true
    const started = Date.now()
    const runId = logRun ? await createFetchRun(this.provider.id) : null

    try {
      const climateLocation = toClimateLocation(location)
      const response = await fetchOpenMeteoCurrentAndHourly(
        climateLocation,
        CLIMATE_CONFIG.forecastHours,
        CLIMATE_CONFIG.pastDays,
      )
      const fetchedAt = new Date().toISOString()
      const current = mapOpenMeteoCurrent(response, fetchedAt, location.elevation_m)
      let hourly = mapOpenMeteoHourly(response)
      if (current) {
        hourly = annotateHourlyTemporalPhases(hourly, current.model_time_utc)
      }
      const metadata = openMeteoSourceMetadata(response, location.elevation_m)

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

      if (runId) {
        await completeFetchRun(runId, {
          status: 'success',
          locations_requested: 1,
          locations_success: 1,
          locations_failed: 0,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - started,
          metrics: {
            location_id: location.id,
            hourly_points: hourly.length,
            requests_per_location: 1,
          },
        })
      }

      return this.buildSnapshot(location, current, hourly, fetchedAt, issuedAt, false)
    } catch (err) {
      if (runId) {
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
      }
      throw err
    }
  }

  async refreshAllActiveLocations(): Promise<ClimateRefreshMetrics> {
    const locations = await listActiveClimateLocations()
    const started = Date.now()
    const runId = await createFetchRun(this.provider.id)
    const failures: ClimateRefreshMetrics['failures'] = []

    const results = await mapWithConcurrency(
      locations,
      CLIMATE_CONFIG.refreshConcurrency,
      async (location) => {
        try {
          await this.refreshLocation(location.id, { logRun: false })
          return { ok: true as const, location }
        } catch (err) {
          return {
            ok: false as const,
            location,
            error: err instanceof Error ? err.message : 'Error',
          }
        }
      },
    )

    let success = 0
    for (const result of results) {
      if (result.ok) success += 1
      else {
        failures.push({
          location_id: result.location.id,
          name: result.location.display_name,
          error: result.error,
        })
      }
    }

    const durationMs = Date.now() - started
    await completeFetchRun(runId, {
      status: failures.length ? 'partial' : 'success',
      locations_requested: locations.length,
      locations_success: success,
      locations_failed: failures.length,
      completed_at: new Date().toISOString(),
      duration_ms: durationMs,
      metrics: {
        requests_total: locations.length,
        requests_per_location: 1,
        max_concurrency: CLIMATE_CONFIG.refreshConcurrency,
        execution_mode: 'batched_parallel',
        failures: failures.length,
      },
      error_message_safe: failures.length ? `${failures.length} ubicaciones fallaron` : null,
    })

    return {
      requested: locations.length,
      success,
      failed: failures.length,
      duration_ms: durationMs,
      requests_total: locations.length,
      requests_per_location: 1,
      max_concurrency: CLIMATE_CONFIG.refreshConcurrency,
      execution_mode: 'batched_parallel',
      failures,
    }
  }

  async getLocationSnapshot(
    locationId: string,
    forceRefresh = false,
  ): Promise<{ snapshot: ClimateSnapshot; timing: ClimateSnapshotTiming }> {
    const totalStart = Date.now()
    let locationMs = 0
    let observationMs = 0
    let forecastMs = 0

    const locStart = Date.now()
    const location = await getClimateLocationById(locationId)
    locationMs = Date.now() - locStart
    if (!location) throw new Error(`Ubicación no encontrada: ${locationId}`)

    const obsStart = Date.now()
    const latestObs = await getLatestObservation(location.id, this.provider.id)
    observationMs = Date.now() - obsStart

    const forecastStart = Date.now()
    const forecast = await listForecastHourly(location.id, this.provider.id, maxHourlyPoints())
    forecastMs = Date.now() - forecastStart

    const currentStale = minutesAgo(latestObs?.fetched_at ?? null, CLIMATE_CONFIG.currentTtlMinutes)
    const forecastStale = minutesAgo(forecast.fetched_at, CLIMATE_CONFIG.forecastTtlMinutes)

    if (forceRefresh || currentStale || forecastStale || !latestObs || forecast.points.length === 0) {
      const refreshed = await this.refreshLocation(locationId)
      return {
        snapshot: refreshed,
        timing: {
          location_ms: locationMs,
          observation_ms: observationMs,
          forecast_ms: forecastMs,
          assemble_ms: Date.now() - totalStart - locationMs - observationMs - forecastMs,
          total_ms: Date.now() - totalStart,
        },
      }
    }

    const assembleStart = Date.now()
    const current = latestObs ? observationFromRow(latestObs.row) : null
    const hourly = current
      ? annotateHourlyTemporalPhases(forecast.points, current.model_time_utc)
      : forecast.points
    const snapshot = this.buildSnapshot(
      location,
      current,
      hourly,
      forecast.fetched_at,
      forecast.issued_at,
      false,
    )
    const assembleMs = Date.now() - assembleStart

    return {
      snapshot,
      timing: {
        location_ms: locationMs,
        observation_ms: observationMs,
        forecast_ms: forecastMs,
        assemble_ms: assembleMs,
        total_ms: Date.now() - totalStart,
      },
    }
  }

  async measureCacheHitLatency(locationId: string, samples = 10): Promise<{
    samples: number
    p50_ms: number
    timings: ClimateSnapshotTiming[]
  }> {
    const timings: ClimateSnapshotTiming[] = []
    for (let i = 0; i < samples; i++) {
      const { timing } = await this.getLocationSnapshot(locationId)
      timings.push(timing)
    }
    const sorted = [...timings].map((t) => t.total_ms).sort((a, b) => a - b)
    const p50 = sorted[Math.floor(sorted.length / 2)] ?? 0
    return { samples, p50_ms: p50, timings }
  }

  async getForecast(locationId: string, hours: number): Promise<ClimateHourlyPoint[]> {
    const { snapshot } = await this.getLocationSnapshot(locationId)
    const reference = snapshot.current?.model_time_utc ?? new Date().toISOString()
    return annotateHourlyTemporalPhases(snapshot.hourly, reference)
      .filter((p) => p.temporal_phase === 'forecast')
      .slice(0, hours)
  }

  async getSystemHealth(): Promise<ClimateSystemHealth> {
    const checkedAt = new Date().toISOString()
    const [providerHealth, dbOk, latestRun, locations, consecutiveFailures] = await Promise.all([
      this.provider.healthCheck(),
      checkDatabaseReachable(),
      getLatestFetchRun(this.provider.id),
      listActiveClimateLocations(),
      countConsecutiveFailures(this.provider.id),
    ])

    let staleCount = 0
    let freshCount = 0
    for (const loc of locations) {
      const obs = await getLatestObservation(loc.id, this.provider.id)
      const forecast = await listForecastHourly(loc.id, this.provider.id, 1)
      const stale =
        minutesAgo(obs?.fetched_at ?? null, CLIMATE_CONFIG.currentTtlMinutes) ||
        minutesAgo(forecast.fetched_at, CLIMATE_CONFIG.forecastTtlMinutes)
      if (stale) staleCount += 1
      else freshCount += 1
    }

    return {
      provider: this.provider.id,
      provider_reachable: providerHealth.ok,
      provider_latency_ms: providerHealth.latency_ms,
      database_reachable: dbOk,
      last_fetch_status: latestRun?.status ?? null,
      last_success_at:
        latestRun?.status === 'success' || latestRun?.status === 'partial'
          ? latestRun.completed_at
          : null,
      stale_locations_count: staleCount,
      locations_total: locations.length,
      locations_fresh: freshCount,
      consecutive_failures: consecutiveFailures,
      checked_at: checkedAt,
    }
  }

  async getStatusSummary() {
    const locations = await listActiveClimateLocations()
    const latestRun = await getLatestFetchRun(this.provider.id)
    const health = await this.getSystemHealth()
    return {
      provider: this.provider.id,
      active_locations: locations.length,
      locations: locations.map((l) => ({
        id: l.id,
        name: l.name,
        display_name: l.display_name,
        location_type: l.location_type,
        location_representation: l.location_representation,
        location_key: l.location_key,
      })),
      latest_fetch_run: latestRun,
      health,
      config: {
        current_ttl_minutes: CLIMATE_CONFIG.currentTtlMinutes,
        forecast_ttl_minutes: CLIMATE_CONFIG.forecastTtlMinutes,
        forecast_hours: CLIMATE_CONFIG.forecastHours,
        past_days: CLIMATE_CONFIG.pastDays,
        refresh_concurrency: CLIMATE_CONFIG.refreshConcurrency,
        elevation_warning_threshold_m: CLIMATE_CONFIG.elevationWarningThresholdM,
      },
    }
  }

  private buildSnapshot(
    location: ClimateLocationRecord,
    current: ClimateCurrentConditions | null,
    hourly: ClimateHourlyPoint[],
    fetchedAt: string | null,
    issuedAt: string | null,
    stale: boolean,
  ): ClimateSnapshot {
    const dataStatus: ClimateDataStatus = {
      provider: this.provider.id,
      model: current?.model ?? 'open-meteo-forecast',
      fetched_at: fetchedAt,
      issued_at: issuedAt,
      next_refresh_at: addMinutes(fetchedAt, CLIMATE_CONFIG.forecastTtlMinutes),
      is_stale: stale,
      quality: buildDataQuality(current, hourly, stale),
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

export function presentationTimeForLocation(utcIso: string, timezone: string): string {
  return formatLocalPresentation(utcIso, timezone)
}
