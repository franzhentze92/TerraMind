import { describe, expect, it } from 'vitest'
import {
  mapOpenMeteoCurrent,
  mapOpenMeteoHourly,
} from './open-meteo.mapper'
import type { OpenMeteoForecastResponse } from './open-meteo.types'

const sampleResponse: OpenMeteoForecastResponse = {
  latitude: 14.63,
  longitude: -90.5,
  elevation: 1500,
  timezone: 'America/Guatemala',
  current: {
    time: '2026-07-10T03:15',
    temperature_2m: 16.9,
    relative_humidity_2m: 97,
    precipitation: 0,
    rain: 0,
    wind_speed_10m: 8.3,
    wind_direction_10m: 344,
    wind_gusts_10m: 18.4,
    cloud_cover: 89,
    surface_pressure: 854.8,
    weather_code: 3,
  },
  hourly: {
    time: ['2026-07-10T03:00', '2026-07-10T04:00'],
    temperature_2m: [16.5, 16.2],
    relative_humidity_2m: [98, 97],
    precipitation_probability: [10, 20],
    precipitation: [0, 0.1],
    rain: [0, 0.1],
    wind_speed_10m: [8, 9],
    wind_direction_10m: [340, 345],
    wind_gusts_10m: [18, 19],
    cloud_cover: [90, 88],
    vapour_pressure_deficit: [0.05, 0.06],
  },
}

describe('open-meteo.mapper', () => {
  it('maps current conditions with normalized units', () => {
    const current = mapOpenMeteoCurrent(sampleResponse, '2026-07-10T09:16:00.000Z')
    expect(current?.temperature_c).toBe(16.9)
    expect(current?.wind_speed_10m_kph).toBe(8.3)
    expect(current?.provider).toBe('open_meteo')
    expect(current?.observed_at).toBe('2026-07-10T03:15')
  })

  it('maps hourly points and preserves timezone-local timestamps', () => {
    const hourly = mapOpenMeteoHourly(sampleResponse, 2)
    expect(hourly).toHaveLength(2)
    expect(hourly[0].timestamp).toBe('2026-07-10T03:00')
    expect(hourly[1].precipitation_mm).toBe(0.1)
    expect(hourly[1].vapor_pressure_deficit_kpa).toBe(0.06)
  })

  it('treats NaN as null', () => {
    const broken = {
      ...sampleResponse,
      current: { ...sampleResponse.current!, temperature_2m: Number.NaN },
    }
    const current = mapOpenMeteoCurrent(broken, '2026-07-10T09:16:00.000Z')
    expect(current?.temperature_c).toBeNull()
  })
})
