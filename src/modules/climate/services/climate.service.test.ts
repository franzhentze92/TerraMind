import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClimateService } from './climate.service'
import * as store from '../stores/climate.store'
import * as client from '../providers/open-meteo/open-meteo.client'
import type { ClimateLocationRecord } from '../types/climate.types'

const location: ClimateLocationRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  location_key: 'country:geo_countries:GT',
  name: 'Guatemala',
  display_name: 'Punto de referencia nacional — centroide geográfico de Guatemala',
  latitude: 15.5,
  longitude: -90.2,
  elevation_m: null,
  timezone: 'America/Guatemala',
  location_type: 'country',
  location_representation: 'point_reference',
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
        observed_at: '2026-07-10T09:15:00.000Z',
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
          timestamp_utc: '2026-07-10T10:00:00.000Z',
          temperature_c: 16,
          relative_humidity_pct: 90,
          precipitation_mm: 0,
          rain_mm: 0,
          wind_speed_10m_kph: 8,
          wind_direction_10m_deg: 10,
          wind_gusts_10m_kph: 15,
          cloud_cover_pct: 80,
          temporal_phase: 'forecast',
        },
      ],
    })
    const fetchSpy = vi.spyOn(client, 'fetchOpenMeteoCurrentAndHourly')

    const { snapshot } = await service.getLocationSnapshot(location.id)
    expect(snapshot.current?.temperature_c).toBe(16)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('registerNationalLocations', () => {
  it('registers 23 territorial centroids as point references', async () => {
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
      display_name: input.display_name,
      latitude: input.latitude,
      longitude: input.longitude,
      elevation_m: null,
      timezone: input.timezone ?? 'America/Guatemala',
      location_type: input.location_type,
      location_representation: input.location_representation ?? 'point_reference',
      related_entity_type: input.related_entity_type ?? null,
      related_entity_id: input.related_entity_id ?? null,
      is_active: true,
      created_at: '2026-07-10T00:00:00.000Z',
      updated_at: '2026-07-10T00:00:00.000Z',
    }))

    const registered = await service.registerNationalLocations()
    expect(registered).toHaveLength(23)
    expect(registered[0].display_name).toContain('Punto de referencia nacional')
  })
})
