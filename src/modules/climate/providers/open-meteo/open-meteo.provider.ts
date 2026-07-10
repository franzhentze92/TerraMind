import type { ClimateProvider } from '../../types/climate-provider.interface'
import type { ClimateLocation, ClimateProviderHealth } from '../../types/climate.types'
import { CLIMATE_CONFIG } from '../../config/climate.config'
import {
  fetchOpenMeteoCurrentAndHourly,
  fetchOpenMeteoDaily,
  fetchOpenMeteoHistorical,
} from './open-meteo.client'
import {
  mapOpenMeteoCurrent,
  mapOpenMeteoDaily,
  mapOpenMeteoHourly,
} from './open-meteo.mapper'

const HEALTH_PROBE: ClimateLocation = {
  latitude: 14.6349,
  longitude: -90.5069,
  timezone: CLIMATE_CONFIG.defaultTimezone,
}

export class OpenMeteoProvider implements ClimateProvider {
  readonly id = 'open_meteo' as const

  async getCurrentConditions(location: ClimateLocation) {
    const fetchedAt = new Date().toISOString()
    const response = await fetchOpenMeteoCurrentAndHourly(location, 1)
    const current = mapOpenMeteoCurrent(response, fetchedAt)
    if (!current) {
      throw new Error('Open-Meteo no devolvió bloque current')
    }
    return current
  }

  async getHourlyForecast(location: ClimateLocation, hours: number) {
    const response = await fetchOpenMeteoCurrentAndHourly(location, hours)
    return mapOpenMeteoHourly(response, hours)
  }

  async getDailyForecast(location: ClimateLocation, days: number) {
    const response = await fetchOpenMeteoDaily(location, days)
    return mapOpenMeteoDaily(response)
  }

  async getHistoricalWeather(location: ClimateLocation, from: string, to: string) {
    const response = await fetchOpenMeteoHistorical(location, from, to)
    return mapOpenMeteoHourly(response)
  }

  async healthCheck(): Promise<ClimateProviderHealth> {
    const started = Date.now()
    const checkedAt = new Date().toISOString()
    try {
      await fetchOpenMeteoCurrentAndHourly(HEALTH_PROBE, 1)
      return {
        provider: this.id,
        ok: true,
        latency_ms: Date.now() - started,
        checked_at: checkedAt,
        message: 'Open-Meteo forecast API reachable',
      }
    } catch (err) {
      return {
        provider: this.id,
        ok: false,
        latency_ms: Date.now() - started,
        checked_at: checkedAt,
        message: err instanceof Error ? err.message : 'Health check failed',
      }
    }
  }
}

export function createClimateProvider(providerId = CLIMATE_CONFIG.provider): ClimateProvider {
  switch (providerId) {
    case 'open_meteo':
      return new OpenMeteoProvider()
    default:
      throw new Error(`Proveedor climático no implementado: ${providerId}`)
  }
}
