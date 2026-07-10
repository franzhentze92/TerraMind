import type { ClimateLocation } from '../../types/climate.types'
import { CLIMATE_CONFIG } from '../../config/climate.config'
import { withRetry } from '@/pipeline/utils/retry'
import { withTimeout } from '@/pipeline/utils/timeout'
import {
  OpenMeteoApiError,
  openMeteoForecastResponseSchema,
  type OpenMeteoForecastResponse,
} from './open-meteo.types'

const CURRENT_VARS = [
  'temperature_2m',
  'relative_humidity_2m',
  'precipitation',
  'rain',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'cloud_cover',
  'surface_pressure',
  'weather_code',
  'soil_temperature_0cm',
  'soil_moisture_0_to_1cm',
].join(',')

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
  'vapour_pressure_deficit',
].join(',')

const DAILY_VARS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'rain_sum',
  'wind_speed_10m_max',
  'weather_code',
].join(',')

function isTransientOpenMeteoError(err: unknown): boolean {
  if (!(err instanceof OpenMeteoApiError)) return false
  if (err.code === 'TIMEOUT' || err.code === 'NETWORK') return true
  if (err.code === 'HTTP_ERROR' && err.status !== undefined && err.status >= 500) return true
  return false
}

function buildForecastUrl(location: ClimateLocation, params: Record<string, string>): string {
  const base = CLIMATE_CONFIG.openMeteo.baseUrl.replace(/\/$/, '')
  const search = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    timezone: location.timezone,
    wind_speed_unit: 'kmh',
    ...params,
  })
  if (location.elevation_m !== null && location.elevation_m !== undefined) {
    search.set('elevation', String(location.elevation_m))
  }
  return `${base}/v1/forecast?${search.toString()}`
}

export async function fetchOpenMeteoForecast(
  location: ClimateLocation,
  params: Record<string, string>,
): Promise<OpenMeteoForecastResponse> {
  const url = buildForecastUrl(location, params)
  const timeoutMs = CLIMATE_CONFIG.openMeteo.timeoutMs

  return withRetry(
    async () => {
      const controller = new AbortController()
      try {
        const response = await withTimeout(
          fetch(url, {
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
              'User-Agent': CLIMATE_CONFIG.openMeteo.userAgent,
            },
          }),
          timeoutMs,
          'open-meteo-forecast',
        )

        if (!response.ok) {
          throw new OpenMeteoApiError(
            'HTTP_ERROR',
            `Open-Meteo respondió ${response.status}`,
            response.status,
          )
        }

        const json: unknown = await response.json()
        const parsed = openMeteoForecastResponseSchema.safeParse(json)
        if (!parsed.success) {
          throw new OpenMeteoApiError(
            'VALIDATION',
            `Respuesta Open-Meteo inválida: ${parsed.error.issues[0]?.message ?? 'schema'}`,
          )
        }
        return parsed.data
      } catch (err) {
        if (err instanceof OpenMeteoApiError) throw err
        if (err instanceof Error) {
          if (err.name === 'AbortError' || err.name === 'StageTimeoutError') {
            throw new OpenMeteoApiError('TIMEOUT', 'Open-Meteo excedió el tiempo límite')
          }
          if (err.message.toLowerCase().includes('fetch failed')) {
            throw new OpenMeteoApiError('NETWORK', 'Error de red al consultar Open-Meteo')
          }
        }
        throw err
      } finally {
        controller.abort()
      }
    },
    {
      maxAttempts: CLIMATE_CONFIG.retry.maxAttempts,
      backoffMs: CLIMATE_CONFIG.retry.backoffMs,
      jitterMs: CLIMATE_CONFIG.retry.jitterMs,
      shouldRetry: isTransientOpenMeteoError,
    },
  )
}

export async function fetchOpenMeteoCurrentAndHourly(
  location: ClimateLocation,
  hours: number,
  pastDays = CLIMATE_CONFIG.pastDays,
): Promise<OpenMeteoForecastResponse> {
  return fetchOpenMeteoForecast(location, {
    current: CURRENT_VARS,
    hourly: HOURLY_VARS,
    forecast_hours: String(hours),
    past_days: String(pastDays),
  })
}

export async function fetchOpenMeteoDaily(
  location: ClimateLocation,
  days: number,
): Promise<OpenMeteoForecastResponse> {
  return fetchOpenMeteoForecast(location, {
    daily: DAILY_VARS,
    forecast_days: String(days),
  })
}

export async function fetchOpenMeteoHistorical(
  location: ClimateLocation,
  from: string,
  to: string,
): Promise<OpenMeteoForecastResponse> {
  const archiveBase = CLIMATE_CONFIG.openMeteo.baseUrl.includes('customer-')
    ? CLIMATE_CONFIG.openMeteo.baseUrl
    : 'https://archive-api.open-meteo.com'

  const search = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    timezone: location.timezone,
    wind_speed_unit: 'kmh',
    hourly: HOURLY_VARS,
    start_date: from,
    end_date: to,
  })

  const url = `${archiveBase.replace(/\/$/, '')}/v1/archive?${search.toString()}`
  const timeoutMs = CLIMATE_CONFIG.openMeteo.timeoutMs

  return withRetry(
    async () => {
      const controller = new AbortController()
      try {
        const response = await withTimeout(
          fetch(url, {
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
              'User-Agent': CLIMATE_CONFIG.openMeteo.userAgent,
            },
          }),
          timeoutMs,
          'open-meteo-archive',
        )
        if (!response.ok) {
          throw new OpenMeteoApiError(
            'HTTP_ERROR',
            `Open-Meteo archive respondió ${response.status}`,
            response.status,
          )
        }
        const json: unknown = await response.json()
        const parsed = openMeteoForecastResponseSchema.safeParse(json)
        if (!parsed.success) {
          throw new OpenMeteoApiError('VALIDATION', 'Respuesta archive inválida')
        }
        return parsed.data
      } catch (err) {
        if (err instanceof OpenMeteoApiError) throw err
        if (err instanceof Error && err.name === 'StageTimeoutError') {
          throw new OpenMeteoApiError('TIMEOUT', 'Open-Meteo archive excedió el tiempo límite')
        }
        throw err
      } finally {
        controller.abort()
      }
    },
    {
      maxAttempts: CLIMATE_CONFIG.retry.maxAttempts,
      backoffMs: CLIMATE_CONFIG.retry.backoffMs,
      jitterMs: CLIMATE_CONFIG.retry.jitterMs,
      shouldRetry: isTransientOpenMeteoError,
    },
  )
}
