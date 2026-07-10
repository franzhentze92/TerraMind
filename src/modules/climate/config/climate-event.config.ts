function readInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function readFloat(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export const CLIMATE_EVENT_CONFIG = {
  timezone: 'America/Guatemala',
  provider: 'open_meteo',
  model: 'open-meteo-forecast',
  maxRepresentativePoints: readInt('CLIMATE_EVENT_MAX_POINTS', 3),
  maxTimeOffsetMinutes: readInt('CLIMATE_EVENT_MAX_TIME_OFFSET_MINUTES', 90),
  dryDayThresholdMm: readFloat('CLIMATE_DRY_DAY_THRESHOLD_MM', 1),
  forecastHours: readInt('CLIMATE_EVENT_FORECAST_HOURS', 72),
  antecedentDays: readInt('CLIMATE_EVENT_ANTECEDENT_DAYS', 30),
  coordinateRoundDecimals: 2,
  cacheTtlMinutes: readInt('CLIMATE_EVENT_CACHE_TTL_MINUTES', 60),
  spatialVariabilityModerateTempC: 2,
  spatialVariabilityHighTempC: 5,
} as const

export const CLIMATE_EVENT_VARIABLES = [
  'temperature_2m',
  'relative_humidity_2m',
  'precipitation',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'cloud_cover',
] as const
