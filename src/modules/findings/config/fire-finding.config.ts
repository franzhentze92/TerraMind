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
  return Number.isFinite(n) ? n : fallback
}

export const FIRE_FINDING_RULE_SET_VERSION = '1.0.0'

export const FIRE_FINDING_CONFIG = {
  nearProtectedAreaThresholdM: readInt('FINDING_NEAR_PROTECTED_AREA_M', 5000),
  dryPrecip24hMm: readFloat('FINDING_DRY_PRECIP_24H_MM', 1),
  dryDaysConsecutive: readInt('FINDING_DRY_DAYS_CONSECUTIVE', 3),
  lowHumidityPct: readFloat('FINDING_LOW_HUMIDITY_PCT', 40),
  strongWindKmh: readFloat('FINDING_STRONG_WIND_KMH', 30),
  strongGustKmh: readFloat('FINDING_STRONG_GUST_KMH', 50),
  populationReliableThreshold: readInt('FINDING_POPULATION_RELIABLE_THRESHOLD', 50),
  forestDominancePct: readFloat('FINDING_FOREST_DOMINANCE_PCT', 40),
  mixedNaturalPct: readFloat('FINDING_MIXED_NATURAL_PCT', 30),
  multiContextMinRules: readInt('FINDING_MULTI_CONTEXT_MIN_RULES', 3),
} as const

export const NATURAL_LAND_COVER_CLASSES = new Set([
  'forest',
  'shrubland',
  'grassland',
  'herbaceous_wetland',
  'mangrove',
  'moss_lichen',
])
