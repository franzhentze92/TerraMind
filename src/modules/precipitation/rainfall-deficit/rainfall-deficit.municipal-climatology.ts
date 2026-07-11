/**
 * Rainfall deficit — municipal climatology & metrics.
 *
 * Builds municipal pentad timelines as the area-weighted mean of member-cell
 * timelines, then computes municipal window metrics (observed vs expected,
 * relative deficit, municipal percentile, standardized anomaly) from the
 * municipal-level accumulated series. Percentiles are municipal-level; per-cell
 * percentiles are never averaged.
 */
import {
  empiricalPercentile,
  robustZScore,
  buildHistoricalDistribution,
} from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.climatology'
import { MINIMUM_EXPECTED_RAINFALL_MM } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.config'
import { CHIRPS_V3_MIN_HISTORY_YEARS } from '@/modules/precipitation/chirps-v3/chirps-v3.config'
import type { ClimatologyDataset } from '@/modules/precipitation/chirps-v3/chirps-climatology.query'
import {
  cellAreaWeight,
  type MunicipalAssignment,
  type Municipality,
} from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.municipal'

export interface MunicipalTimeline {
  pcode: string
  /** Flat [yearIndex*slots + slotIndex] area-weighted mean pentad precipitation. */
  values: Float32Array
  cellCount: number
}

export function buildMunicipalTimelines(
  ds: ClimatologyDataset,
  assignment: MunicipalAssignment,
): Map<string, MunicipalTimeline> {
  const nYears = ds.years.length
  const slots = ds.slotsPerYear
  const span = nYears * slots
  const cellLats = ds.grid.cells.map((c) => c.lat)
  const out = new Map<string, MunicipalTimeline>()

  for (const [pcode, cellIndices] of assignment.byMunicipality) {
    const values = new Float32Array(span).fill(Number.NaN)
    if (cellIndices.length === 0) {
      out.set(pcode, { pcode, values, cellCount: 0 })
      continue
    }
    for (let g = 0; g < span; g++) {
      let num = 0
      let den = 0
      for (const cell of cellIndices) {
        const v = ds.matrix[cell * span + g]!
        if (!Number.isFinite(v)) continue
        const w = cellAreaWeight(cellLats[cell]!)
        num += v * w
        den += w
      }
      values[g] = den > 0 ? num / den : Number.NaN
    }
    out.set(pcode, { pcode, values, cellCount: cellIndices.length })
  }
  return out
}

function windowSamplesFromTimeline(
  timeline: Float32Array,
  nYears: number,
  slots: number,
  endSlot: number,
  windowPentads: number,
  excludeYearIndex?: number,
): { samples: number[]; missingYears: number } {
  const samples: number[] = []
  let missingYears = 0
  for (let y = 0; y < nYears; y++) {
    if (y === excludeYearIndex) continue
    const endGlobal = y * slots + (endSlot - 1)
    const startGlobal = endGlobal - (windowPentads - 1)
    if (startGlobal < 0) continue
    let sum = 0
    let ok = true
    for (let g = startGlobal; g <= endGlobal; g++) {
      const v = timeline[g]!
      if (!Number.isFinite(v)) {
        ok = false
        break
      }
      sum += v
    }
    if (ok) samples.push(sum)
    else missingYears++
  }
  return { samples, missingYears }
}

export interface MunicipalWindowMetric {
  pcode: string
  observedMm: number | undefined
  expectedMm: number | undefined
  relativeDeficitPercent: number | undefined
  historicalPercentile: number | undefined
  standardizedAnomaly: number | undefined
  historicalSampleYears: number
  missingYears: number
  cellCount: number
  sufficientHistory: boolean
}

/**
 * Compute municipal window metric for a target year/slot. Uses leave-one-out
 * when `observedYearIndex` is a baseline year (validation), otherwise treats
 * `observedMm` as externally supplied.
 */
export function municipalWindowMetric(
  timeline: MunicipalTimeline,
  nYears: number,
  slots: number,
  endSlot: number,
  windowPentads: number,
  opts: { observedYearIndex?: number; observedMm?: number },
): MunicipalWindowMetric {
  const excludeYearIndex = opts.observedYearIndex
  const { samples, missingYears } = windowSamplesFromTimeline(
    timeline.values,
    nYears,
    slots,
    endSlot,
    windowPentads,
    excludeYearIndex,
  )

  let observedMm = opts.observedMm
  if (observedMm === undefined && excludeYearIndex !== undefined) {
    const endGlobal = excludeYearIndex * slots + (endSlot - 1)
    const startGlobal = endGlobal - (windowPentads - 1)
    if (startGlobal >= 0) {
      let sum = 0
      let ok = true
      for (let g = startGlobal; g <= endGlobal; g++) {
        const v = timeline.values[g]!
        if (!Number.isFinite(v)) {
          ok = false
          break
        }
        sum += v
      }
      observedMm = ok ? sum : undefined
    }
  }

  const hist = buildHistoricalDistribution(samples)
  const expected = samples.length >= 1 ? hist.median : undefined
  const relativeDeficit =
    observedMm !== undefined && expected !== undefined && expected >= MINIMUM_EXPECTED_RAINFALL_MM
      ? Math.round(((expected - observedMm) / expected) * 100)
      : undefined
  const percentile = observedMm !== undefined ? empiricalPercentile(observedMm, samples) : undefined
  const anomaly = observedMm !== undefined ? robustZScore(observedMm, samples) : undefined

  return {
    pcode: timeline.pcode,
    observedMm,
    expectedMm: expected,
    relativeDeficitPercent: relativeDeficit,
    historicalPercentile: percentile,
    standardizedAnomaly: anomaly,
    historicalSampleYears: samples.length,
    missingYears,
    cellCount: timeline.cellCount,
    sufficientHistory: samples.length >= CHIRPS_V3_MIN_HISTORY_YEARS,
  }
}

export function municipalityLabel(m: Municipality): string {
  return `${m.name}, ${m.adm1Name}`
}
