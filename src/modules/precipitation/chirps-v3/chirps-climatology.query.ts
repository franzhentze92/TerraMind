/**
 * CHIRPS v3 — climatology query API.
 *
 * Loads the consolidated baseline matrix (per-cell continuous pentad timeline)
 * and derives same-season moving-window accumulation samples for percentile /
 * anomaly computation. Windows accumulate real precipitation across pentads
 * (never averages of percentiles).
 */
import { existsSync, readFileSync } from 'node:fs'
import {
  CLIMATOLOGY_BIN_PATH,
  PENTADS_PER_YEAR,
  loadClimatologyMeta,
  loadGrid,
  type ClimatologyGrid,
  type ClimatologyMeta,
} from '@/modules/precipitation/chirps-v3/chirps-climatology.store'

export interface ClimatologyDataset {
  grid: ClimatologyGrid
  meta: ClimatologyMeta
  /** Flat timeline matrix: [cell * (years*72) + (yearIndex*72 + slotIndex)]. */
  matrix: Float32Array
  years: number[]
  slotsPerYear: number
}

let cached: ClimatologyDataset | null = null

export function isClimatologyAvailable(): boolean {
  return existsSync(CLIMATOLOGY_BIN_PATH) && loadClimatologyMeta() !== null && loadGrid() !== null
}

export function loadClimatologyDataset(force = false): ClimatologyDataset | null {
  if (cached && !force) return cached
  const grid = loadGrid()
  const meta = loadClimatologyMeta()
  if (!grid || !meta || !existsSync(CLIMATOLOGY_BIN_PATH)) return null
  const buf = readFileSync(CLIMATOLOGY_BIN_PATH)
  const matrix = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
  cached = { grid, meta, matrix, years: meta.years, slotsPerYear: PENTADS_PER_YEAR }
  return cached
}

/**
 * Same-season moving-window accumulation samples for a cell.
 *
 * For each baseline year, sums the `windowPentads` pentads ending at `endSlot`
 * (wrapping into the previous baseline year when the window crosses Jan 1).
 * Years whose window contains any NoData/missing pentad are dropped and counted.
 */
export function windowSamplesForCell(
  ds: ClimatologyDataset,
  cellIndex: number,
  endSlot: number,
  windowPentads: number,
): { samples: number[]; missingYears: number } {
  const nYears = ds.years.length
  const slots = ds.slotsPerYear
  const base = cellIndex * nYears * slots
  const samples: number[] = []
  let missingYears = 0

  for (let y = 0; y < nYears; y++) {
    const endGlobal = y * slots + (endSlot - 1)
    const startGlobal = endGlobal - (windowPentads - 1)
    if (startGlobal < 0) continue // no predecessor year for early-season wrap
    let sum = 0
    let ok = true
    for (let g = startGlobal; g <= endGlobal; g++) {
      const v = ds.matrix[base + g]!
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

/** Map a (month, pentad) observation date to a continuous end-slot (1..72). */
export function endSlotFor(month: number, pentad: number): number {
  return (month - 1) * 6 + pentad
}
