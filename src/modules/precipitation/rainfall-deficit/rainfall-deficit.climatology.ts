/**
 * Rainfall deficit — climatology and percentile computation (same-season pentads).
 */
import {
  CHIRPS_V3_BASELINE_END,
  CHIRPS_V3_BASELINE_START,
  CHIRPS_V3_MIN_HISTORY_YEARS,
} from '@/modules/precipitation/chirps-v3/chirps-v3.config'
import type { RainfallWindowMetrics } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.types'
import { MINIMUM_EXPECTED_RAINFALL_MM } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.config'

export interface HistoricalDistribution {
  samples: number[]
  median: number
  mean: number
  sampleYears: number
  baselineStartYear: number
  baselineEndYear: number
}

export function buildHistoricalDistribution(samples: number[]): HistoricalDistribution {
  const valid = samples.filter((v) => Number.isFinite(v) && v >= 0)
  const sorted = [...valid].sort((a, b) => a - b)
  const n = sorted.length
  const median = n === 0 ? undefined : n % 2 === 1 ? sorted[(n - 1) / 2]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2
  const mean = n === 0 ? undefined : sorted.reduce((a, b) => a + b, 0) / n
  return {
    samples: sorted,
    median: median ?? 0,
    mean: mean ?? 0,
    sampleYears: n,
    baselineStartYear: CHIRPS_V3_BASELINE_START,
    baselineEndYear: CHIRPS_V3_BASELINE_END,
  }
}

/** Empirical percentile rank (0–100): fraction of historical values <= observed. */
export function empiricalPercentile(observed: number, samples: number[]): number | undefined {
  const valid = samples.filter((v) => Number.isFinite(v))
  if (valid.length < CHIRPS_V3_MIN_HISTORY_YEARS) return undefined
  const below = valid.filter((v) => v <= observed).length
  return Math.round((below / valid.length) * 100)
}

export function robustZScore(observed: number, samples: number[]): number | undefined {
  const valid = samples.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (valid.length < CHIRPS_V3_MIN_HISTORY_YEARS) return undefined
  const median = valid[Math.floor(valid.length / 2)]!
  const absDev = valid.map((v) => Math.abs(v - median)).sort((a, b) => a - b)
  const mad = absDev[Math.floor(absDev.length / 2)]!
  if (mad === 0) return undefined
  return (0.6745 * (observed - median)) / mad
}

export function computeWindowMetrics(
  observedMm: number,
  historicalSamples: number[],
  windowDays: number,
  windowPentads: number,
): RainfallWindowMetrics {
  const hist = buildHistoricalDistribution(historicalSamples)
  const expected = hist.median
  const absoluteDeficit =
    expected !== undefined && Number.isFinite(expected) ? Math.max(0, expected - observedMm) : undefined
  const relativeDeficit =
    expected !== undefined && expected >= MINIMUM_EXPECTED_RAINFALL_MM
      ? Math.round(((expected - observedMm) / expected) * 100)
      : undefined
  return {
    analysisWindowDays: windowDays,
    analysisWindowPentads: windowPentads,
    observedRainfallMm: observedMm,
    expectedRainfallMm: expected,
    absoluteDeficitMm: absoluteDeficit,
    relativeDeficitPercent: relativeDeficit,
    historicalPercentile: empiricalPercentile(observedMm, historicalSamples),
    standardizedAnomaly: robustZScore(observedMm, historicalSamples),
    historicalSampleYears: hist.sampleYears,
  }
}

export function hasSufficientHistory(samples: number[]): boolean {
  return samples.filter((v) => Number.isFinite(v)).length >= CHIRPS_V3_MIN_HISTORY_YEARS
}
