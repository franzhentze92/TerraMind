import type { ClimateProviderId } from '../types/climate.types'

function readInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const CLIMATE_CONFIG = {
  provider: (process.env.CLIMATE_PROVIDER?.trim() ?? 'open_meteo') as ClimateProviderId,
  currentTtlMinutes: readInt('CLIMATE_CURRENT_TTL_MINUTES', 30),
  forecastTtlMinutes: readInt('CLIMATE_FORECAST_TTL_MINUTES', 60),
  forecastHours: readInt('CLIMATE_FORECAST_HOURS', 72),
  defaultTimezone: 'America/Guatemala',
  rainProbabilityThresholdPct: 50,
  openMeteo: {
    baseUrl: process.env.OPEN_METEO_BASE_URL?.trim() ?? 'https://api.open-meteo.com',
    timeoutMs: readInt('OPEN_METEO_TIMEOUT_MS', 15_000),
    userAgent:
      process.env.OPEN_METEO_USER_AGENT?.trim() ??
      'TerraMind/1.0 (climate-intelligence-core; non-commercial research)',
  },
  retry: {
    maxAttempts: 3,
    backoffMs: [1_000, 3_000, 5_000] as const,
    jitterMs: 500,
  },
} as const
