import { z } from 'zod'

const nullableNumber = z
  .union([z.number(), z.null()])
  .transform((v) => (v === null || Number.isNaN(v) ? null : v))

export const openMeteoCurrentSchema = z.object({
  time: z.string(),
  interval: z.number().optional(),
  temperature_2m: nullableNumber.optional(),
  relative_humidity_2m: nullableNumber.optional(),
  precipitation: nullableNumber.optional(),
  rain: nullableNumber.optional(),
  wind_speed_10m: nullableNumber.optional(),
  wind_direction_10m: nullableNumber.optional(),
  wind_gusts_10m: nullableNumber.optional(),
  cloud_cover: nullableNumber.optional(),
  surface_pressure: nullableNumber.optional(),
  weather_code: nullableNumber.optional(),
  soil_temperature_0cm: nullableNumber.optional(),
  soil_moisture_0_to_1cm: nullableNumber.optional(),
})

export const openMeteoHourlySchema = z.object({
  time: z.array(z.string()),
  temperature_2m: z.array(nullableNumber).optional(),
  relative_humidity_2m: z.array(nullableNumber).optional(),
  precipitation_probability: z.array(nullableNumber).optional(),
  precipitation: z.array(nullableNumber).optional(),
  rain: z.array(nullableNumber).optional(),
  wind_speed_10m: z.array(nullableNumber).optional(),
  wind_direction_10m: z.array(nullableNumber).optional(),
  wind_gusts_10m: z.array(nullableNumber).optional(),
  cloud_cover: z.array(nullableNumber).optional(),
  vapour_pressure_deficit: z.array(nullableNumber).optional(),
})

export const openMeteoDailySchema = z.object({
  time: z.array(z.string()),
  temperature_2m_max: z.array(nullableNumber).optional(),
  temperature_2m_min: z.array(nullableNumber).optional(),
  precipitation_sum: z.array(nullableNumber).optional(),
  rain_sum: z.array(nullableNumber).optional(),
  wind_speed_10m_max: z.array(nullableNumber).optional(),
  weather_code: z.array(nullableNumber).optional(),
})

export const openMeteoForecastResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number().optional(),
  generationtime_ms: z.number().optional(),
  utc_offset_seconds: z.number().optional(),
  timezone: z.string().optional(),
  timezone_abbreviation: z.string().optional(),
  current: openMeteoCurrentSchema.optional(),
  hourly: openMeteoHourlySchema.optional(),
  daily: openMeteoDailySchema.optional(),
})

export type OpenMeteoForecastResponse = z.infer<typeof openMeteoForecastResponseSchema>

export class OpenMeteoApiError extends Error {
  readonly code: 'HTTP_ERROR' | 'TIMEOUT' | 'NETWORK' | 'VALIDATION' | 'NOT_IMPLEMENTED'
  readonly status?: number

  constructor(code: OpenMeteoApiError['code'], message: string, status?: number) {
    super(message)
    this.name = 'OpenMeteoApiError'
    this.code = code
    this.status = status
  }
}
