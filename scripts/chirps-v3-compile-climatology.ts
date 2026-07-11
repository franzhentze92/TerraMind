#!/usr/bin/env npx tsx
/**
 * CHIRPS v3 — climatology compiler.
 *
 * Consolidates the per-pentad Float32 cache into a single continuous per-cell
 * timeline matrix + metadata. Missing pentads become NaN. Run after the builder.
 *
 *   npx tsx scripts/chirps-v3-compile-climatology.ts --start-year=1991 --end-year=2020
 */
import { CHIRPS_V3_PROCESSING_VERSION } from '@/modules/precipitation/chirps-v3/chirps-v3.config'
import {
  PENTADS_PER_YEAR,
  loadGrid,
  readPentadCache,
  saveClimatologyMatrix,
} from '@/modules/precipitation/chirps-v3/chirps-climatology.store'

function arg(name: string, fallback: number): number {
  const v = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
  return v ? Number(v) : fallback
}

function main() {
  const startYear = arg('start-year', 1991)
  const endYear = arg('end-year', 2020)
  const grid = loadGrid()
  if (!grid) {
    console.error('[compile] grid.json no existe; ejecuta el builder primero.')
    process.exit(2)
  }
  const years: number[] = []
  for (let y = startYear; y <= endYear; y++) years.push(y)
  const nYears = years.length
  const cellCount = grid.cellCount
  const slots = PENTADS_PER_YEAR

  const matrix = new Float32Array(cellCount * nYears * slots).fill(Number.NaN)
  let filledSlots = 0
  let missingSlots = 0

  for (let yIdx = 0; yIdx < nYears; yIdx++) {
    const year = years[yIdx]!
    for (let slot = 1; slot <= slots; slot++) {
      const values = readPentadCache(year, slot, cellCount)
      if (!values) {
        missingSlots++
        continue
      }
      filledSlots++
      for (let cell = 0; cell < cellCount; cell++) {
        matrix[cell * nYears * slots + yIdx * slots + (slot - 1)] = values[cell]!
      }
    }
  }

  const meta = saveClimatologyMatrix(matrix, {
    baselineStartYear: startYear,
    baselineEndYear: endYear,
    years,
    pentadsPerYear: slots,
    cellCount,
    processingVersion: CHIRPS_V3_PROCESSING_VERSION,
    builtAt: new Date().toISOString(),
  })

  console.log(`[compile] celdas=${cellCount} años=${nYears} pentadas/año=${slots}`)
  console.log(`[compile] slots llenos=${filledSlots} faltantes=${missingSlots}`)
  console.log(`[compile] matriz=${(matrix.byteLength / 1e6).toFixed(1)}MB checksum=${meta.checksum.slice(0, 12)}…`)
}

main()
