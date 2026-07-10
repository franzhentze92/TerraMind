import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchOpenMeteoForecast } from './open-meteo.client'
import { OpenMeteoApiError } from './open-meteo.types'

const location = {
  latitude: 14.6349,
  longitude: -90.5069,
  timezone: 'America/Guatemala',
}

describe('open-meteo.client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('validates successful response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          latitude: 14.63,
          longitude: -90.5,
          current: { time: '2026-07-10T03:15', temperature_2m: 17 },
          hourly: { time: ['2026-07-10T03:00'], temperature_2m: [17] },
        }),
        { status: 200 },
      ),
    )

    const data = await fetchOpenMeteoForecast(location, {
      current: 'temperature_2m',
      hourly: 'temperature_2m',
      forecast_hours: '1',
    })
    expect(data.latitude).toBe(14.63)
  })

  it('does not retry validation errors', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ invalid: true }), { status: 200 }),
    )

    await expect(
      fetchOpenMeteoForecast(location, { current: 'temperature_2m', forecast_hours: '1' }),
    ).rejects.toBeInstanceOf(OpenMeteoApiError)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries transient HTTP 503', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('down', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            latitude: 14.63,
            longitude: -90.5,
            current: { time: '2026-07-10T03:15', temperature_2m: 17 },
          }),
          { status: 200 },
        ),
      )

    const data = await fetchOpenMeteoForecast(location, {
      current: 'temperature_2m',
      forecast_hours: '1',
    })
    expect(data.current?.temperature_2m).toBe(17)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
