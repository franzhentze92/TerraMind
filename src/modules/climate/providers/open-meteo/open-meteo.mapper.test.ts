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
  utc_offset_seconds: -21_600,
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
  it('maps current conditions to UTC model time', () => {
    const current = mapOpenMeteoCurrent(sampleResponse, '2026-07-10T09:16:00.000Z', 2330)
    expect(current?.model_time_utc).toBe('2026-07-10T09:15:00.000Z')
    expect(current?.provider_elevation_m).toBe(1500)
    expect(current?.registered_elevation_m).toBe(2330)
    expect(current?.elevation_difference_m).toBe(830)
  })

  it('maps hourly points with UTC timestamps', () => {
    const hourly = mapOpenMeteoHourly(sampleResponse)
    expect(hourly).toHaveLength(2)
    expect(hourly[0].timestamp_utc).toBe('2026-07-10T09:00:00.000Z')
  })

  it('treats NaN as null', () => {
    const broken = {
      ...sampleResponse,
      current: { ...sampleResponse.current!, temperature_2m: Number.NaN },
    }
    const current = mapOpenMeteoCurrent(broken, '2026-07-10T09:16:00.000Z', null)
    expect(current?.temperature_c).toBeNull()
  })
})
