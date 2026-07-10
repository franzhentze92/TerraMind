import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClimateService } from './climate.service'
import * as store from '../stores/climate.store'
import * as client from '../providers/open-meteo/open-meteo.client'
import type { ClimateLocationRecord } from '../types/climate.types'

const location: ClimateLocationRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  location_key: 'country:geo_countries:GT',
  name: 'Guatemala',
  latitude: 15.5,
  longitude: -90.2,
  elevation_m: null,
  timezone: 'America/Guatemala',
  location_type: 'country',
  related_entity_type: 'geo_countries',
  related_entity_id: 'GT',
  is_active: true,
  created_at: '2026-07-10T00:00:00.000Z',
  updated_at: '2026-07-10T00:00:00.000Z',
}

describe('ClimateService cache', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reuses fresh DB snapshot without provider call', async () => {
    const service = new ClimateService()
    const freshFetched = new Date().toISOString()

    vi.spyOn(store, 'getClimateLocationById').mockResolvedValue(location)
    vi.spyOn(store, 'getLatestObservation').mockResolvedValue({
      fetched_at: freshFetched,
      row: {
        observed_at: '2026-07-10T03:15',
        temperature_c: 16,
        relative_humidity_pct: 90,
        precipitation_mm: 0,
        rain_mm: 0,
        wind_speed_10m_kph: 8,
        wind_direction_10m_deg: 10,
        wind_gusts_10m_kph: 15,
        cloud_cover_pct: 80,
        surface_pressure_hpa: 850,
        provider: 'open_meteo',
        model: 'open-meteo-forecast',
        fetched_at: freshFetched,
        optional_variables: {},
      },
    })
    vi.spyOn(store, 'listForecastHourly').mockResolvedValue({
      fetched_at: freshFetched,
      issued_at: freshFetched,
      points: [
        {
          timestamp: '2026-07-10T04:00',
          temperature_c: 16,
          relative_humidity_pct: 90,
          precipitation_mm: 0,
          rain_mm: 0,
          wind_speed_10m_kph: 8,
          wind_direction_10m_deg: 10,
          wind_gusts_10m_kph: 15,
          cloud_cover_pct: 80,
        },
      ],
    })
    const fetchSpy = vi.spyOn(client, 'fetchOpenMeteoCurrentAndHourly')

    const snapshot = await service.getLocationSnapshot(location.id)
    expect(snapshot.current?.temperature_c).toBe(16)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('refreshes when data is stale', async () => {
    const service = new ClimateService()
    const staleFetched = new Date(Date.now() - 2 * 60 * 60_000).toISOString()

    vi.spyOn(store, 'getClimateLocationById').mockResolvedValue(location)
    vi.spyOn(store, 'getLatestObservation').mockResolvedValue({
      fetched_at: staleFetched,
      row: {
        observed_at: '2026-07-10T01:15',
        temperature_c: 14,
        relative_humidity_pct: 90,
        precipitation_mm: 0,
        rain_mm: 0,
        wind_speed_10m_kph: 8,
        wind_direction_10m_deg: 10,
        wind_gusts_10m_kph: 15,
        cloud_cover_pct: 80,
        surface_pressure_hpa: 850,
        provider: 'open_meteo',
        model: 'open-meteo-forecast',
        fetched_at: staleFetched,
        optional_variables: {},
      },
    })
    vi.spyOn(store, 'listForecastHourly').mockResolvedValue({
      fetched_at: staleFetched,
      issued_at: staleFetched,
      points: [],
    })
    vi.spyOn(store, 'createFetchRun').mockResolvedValue('run-1')
    vi.spyOn(store, 'completeFetchRun').mockResolvedValue()
    vi.spyOn(store, 'upsertObservation').mockResolvedValue()
    vi.spyOn(store, 'upsertForecasts').mockResolvedValue(1)
    vi.spyOn(client, 'fetchOpenMeteoCurrentAndHourly').mockResolvedValue({
      latitude: 15.5,
      longitude: -90.2,
      current: {
        time: '2026-07-10T03:15',
        temperature_2m: 17,
        relative_humidity_2m: 88,
        precipitation: 0,
        rain: 0,
        wind_speed_10m: 9,
        wind_direction_10m: 20,
        wind_gusts_10m: 16,
        cloud_cover: 70,
        surface_pressure: 851,
      },
      hourly: {
        time: ['2026-07-10T04:00'],
        temperature_2m: [17],
        relative_humidity_2m: [88],
        precipitation: [0],
        rain: [0],
        wind_speed_10m: [9],
        wind_direction_10m: [20],
        wind_gusts_10m: [16],
        cloud_cover: [70],
      },
    })

    const snapshot = await service.getLocationSnapshot(location.id)
    expect(snapshot.current?.temperature_c).toBe(17)
  })
})

describe('registerNationalLocations', () => {
  it('registers 23 territorial centroids', async () => {
    const service = new ClimateService()
    const centroids = [
      {
        entity_type: 'geo_countries',
        entity_id: 'GT',
        name: 'Guatemala',
        latitude: 15.5,
        longitude: -90.2,
      },
      ...Array.from({ length: 22 }, (_, i) => ({
        entity_type: 'geo_departments',
        entity_id: `GT:${String(i + 1).padStart(2, '0')}`,
        name: `Depto ${i + 1}`,
        latitude: 14 + i * 0.1,
        longitude: -91 + i * 0.1,
      })),
    ]

    vi.spyOn(store, 'listTerritorialCentroids').mockResolvedValue(centroids)
    vi.spyOn(store, 'upsertClimateLocation').mockImplementation(async (input) => ({
      id: `id-${input.location_key}`,
      location_key: input.location_key,
      name: input.name,
      latitude: input.latitude,
      longitude: input.longitude,
      elevation_m: null,
      timezone: input.timezone ?? 'America/Guatemala',
      location_type: input.location_type,
      related_entity_type: input.related_entity_type ?? null,
      related_entity_id: input.related_entity_id ?? null,
      is_active: true,
      created_at: '2026-07-10T00:00:00.000Z',
      updated_at: '2026-07-10T00:00:00.000Z',
    }))

    const registered = await service.registerNationalLocations()
    expect(registered).toHaveLength(23)
  })
})
