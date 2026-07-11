/**
 * Rainfall deficit — versioned detection thresholds (configurable, not universal truth).
 */
export const RAINFALL_DEFICIT_ALGORITHM_VERSION = 'rainfall-deficit-v1'

export const RAINFALL_DEFICIT_WINDOWS = {
  days15: { days: 15, pentads: 3 },
  days30: { days: 30, pentads: 6 },
  days60: { days: 60, pentads: 12 },
} as const

export const CANONICAL_WINDOW_KEY = 'days30' as const

/** Minimum expected rainfall (mm) in window to avoid absurd % during normal dry season. */
export const MINIMUM_EXPECTED_RAINFALL_MM = 5

export interface RainfallDeficitThresholdTier {
  relativeDeficitPercent: number
  historicalPercentileMax: number
  minConsecutivePentads: number
}

export const CANDIDATE_THRESHOLD: RainfallDeficitThresholdTier = {
  relativeDeficitPercent: 30,
  historicalPercentileMax: 20,
  minConsecutivePentads: 2,
}

export const ELEVATED_THRESHOLD: RainfallDeficitThresholdTier = {
  relativeDeficitPercent: 40,
  historicalPercentileMax: 15,
  minConsecutivePentads: 3,
}

export const SEVERE_THRESHOLD: RainfallDeficitThresholdTier = {
  relativeDeficitPercent: 50,
  historicalPercentileMax: 10,
  minConsecutivePentads: 4,
}

export const CLUSTER_MIN_CELLS = 4
export const CLUSTER_MIN_AREA_KM2 = 25

export const LIFECYCLE_GRACE_UPDATES = 2
