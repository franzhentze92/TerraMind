import { climateService } from '@/modules/climate/services/climate.service'
import {
  assertSafeClimateDto,
  toClimateHealthDto,
  toClimateSnapshotDto,
} from '@/modules/climate/dto/climate-api.dto'
import { CLIMATE_CONFIG } from '@/modules/climate/config/climate.config'

export async function getClimateSnapshotForApi(locationId: string) {
  const snapshot = await climateService.getLocationSnapshot(locationId)
  const dto = toClimateSnapshotDto(snapshot)
  assertSafeClimateDto(dto)
  return dto
}

export async function getClimateHourlyForApi(locationId: string, hours: number) {
  const safeHours =
    Number.isFinite(hours) && hours > 0
      ? Math.min(hours, CLIMATE_CONFIG.forecastHours)
      : CLIMATE_CONFIG.forecastHours

  const points = await climateService.getForecast(locationId, safeHours)
  const payload = {
    location_id: locationId,
    hours: safeHours,
    items: points.map((p) => ({
      timestamp: p.timestamp,
      temperature_c: p.temperature_c,
      relative_humidity_pct: p.relative_humidity_pct,
      precipitation_probability_pct: p.precipitation_probability_pct ?? null,
      precipitation_mm: p.precipitation_mm,
      rain_mm: p.rain_mm,
      wind_speed_10m_kph: p.wind_speed_10m_kph,
      wind_direction_10m_deg: p.wind_direction_10m_deg,
      wind_gusts_10m_kph: p.wind_gusts_10m_kph,
      cloud_cover_pct: p.cloud_cover_pct,
    })),
    generated_at: new Date().toISOString(),
  }
  assertSafeClimateDto(payload)
  return payload
}

export async function getClimateHealthForApi() {
  const health = await climateService.getProviderHealth()
  const dto = toClimateHealthDto(health)
  assertSafeClimateDto(dto)
  return dto
}
