/**
 * Tests — climatology query (moving-window accumulation) + municipal climatology.
 * Uses a synthetic in-memory dataset (no disk / no downloads).
 */
import { describe, expect, it } from 'vitest'
import type { ClimatologyDataset } from '@/modules/precipitation/chirps-v3/chirps-climatology.query'
import { endSlotFor, windowSamplesForCell } from '@/modules/precipitation/chirps-v3/chirps-climatology.query'
import type { ClimatologyGrid, ClimatologyMeta } from '@/modules/precipitation/chirps-v3/chirps-climatology.store'
import {
  buildMunicipalTimelines,
  municipalWindowMetric,
} from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.municipal-climatology'
import type { MunicipalAssignment } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.municipal'

const SLOTS = 72

function makeDataset(cellCount: number, nYears: number, fill: (cell: number, year: number, slot: number) => number): ClimatologyDataset {
  const grid: ClimatologyGrid = {
    rows: 1,
    cols: cellCount,
    cellCount,
    bbox: [-92, 13, -88, 18],
    resolutionDeg: 0.05,
    cells: Array.from({ length: cellCount }, (_, i) => ({ row: 0, col: i, lat: 15, lon: -90 + i * 0.05 })),
  }
  const years = Array.from({ length: nYears }, (_, i) => 1991 + i)
  const matrix = new Float32Array(cellCount * nYears * SLOTS)
  for (let cell = 0; cell < cellCount; cell++) {
    for (let y = 0; y < nYears; y++) {
      for (let s = 0; s < SLOTS; s++) {
        matrix[cell * nYears * SLOTS + y * SLOTS + s] = fill(cell, y, s)
      }
    }
  }
  const meta: ClimatologyMeta = {
    baselineStartYear: 1991,
    baselineEndYear: 1991 + nYears - 1,
    years,
    pentadsPerYear: SLOTS,
    cellCount,
    processingVersion: 'test',
    checksum: 'test',
    builtAt: new Date().toISOString(),
  }
  return { grid, meta, matrix, years, slotsPerYear: SLOTS }
}

describe('climatology window accumulation', () => {
  it('accumulates the correct number of pentads per window', () => {
    const ds = makeDataset(1, 25, () => 10) // 10mm every pentad
    const endSlot = endSlotFor(7, 2) // mid-year, no wrap issues
    const { samples, missingYears } = windowSamplesForCell(ds, 0, endSlot, 6)
    expect(missingYears).toBe(0)
    expect(samples.length).toBe(25)
    // 6 pentads * 10mm = 60mm per year
    expect(samples.every((v) => Math.abs(v - 60) < 1e-4)).toBe(true)
  })

  it('drops the first baseline year when window wraps before Jan 1', () => {
    const ds = makeDataset(1, 25, () => 5)
    const { samples } = windowSamplesForCell(ds, 0, 2, 6) // endSlot 2, window 6 → needs prev year
    // year 0 lacks predecessor → 24 usable years
    expect(samples.length).toBe(24)
  })

  it('counts years with NoData in the window as missing', () => {
    const ds = makeDataset(1, 25, (_c, y, s) => (y === 5 && s === 40 ? Number.NaN : 8))
    const endSlot = 41 // slot index 40 is within window
    const { samples, missingYears } = windowSamplesForCell(ds, 0, endSlot, 3)
    expect(missingYears).toBe(1)
    expect(samples.length).toBe(24)
  })
})

describe('municipal climatology', () => {
  it('builds municipal timeline as area-weighted mean of member cells', () => {
    const ds = makeDataset(2, 22, (cell) => (cell === 0 ? 10 : 20))
    const assignment: MunicipalAssignment = {
      byMunicipality: new Map([['GT0101', [0, 1]]]),
      cellToMunicipality: [ 'GT0101', 'GT0101' ],
      lowCoveragePcodes: [],
    }
    const timelines = buildMunicipalTimelines(ds, assignment)
    const t = timelines.get('GT0101')!
    // Equal latitude → equal weight → mean of 10 and 20 = 15
    expect(t.values[0]).toBeCloseTo(15, 4)
    expect(t.cellCount).toBe(2)
  })

  it('flags a dry observed year with low percentile (leave-one-out)', () => {
    // Normal ~100mm/window; make year index 3 extremely dry.
    const ds = makeDataset(1, 22, (_c, y, s) => {
      const perPentad = y === 3 ? 2 : 18 // 6*18=108 normal; 6*2=12 dry
      return s >= 0 ? perPentad : perPentad
    })
    const assignment: MunicipalAssignment = {
      byMunicipality: new Map([['GT0101', [0]]]),
      cellToMunicipality: ['GT0101'],
      lowCoveragePcodes: [],
    }
    const timelines = buildMunicipalTimelines(ds, assignment)
    const metric = municipalWindowMetric(timelines.get('GT0101')!, 22, SLOTS, 42, 6, { observedYearIndex: 3 })
    expect(metric.observedMm).toBeCloseTo(12, 4)
    expect(metric.expectedMm).toBeCloseTo(108, 4)
    expect(metric.relativeDeficitPercent!).toBeGreaterThan(80)
    expect(metric.historicalPercentile!).toBeLessThanOrEqual(20)
    expect(metric.sufficientHistory).toBe(true)
  })

  it('does not flag a normal year', () => {
    const ds = makeDataset(1, 22, () => 18)
    const assignment: MunicipalAssignment = {
      byMunicipality: new Map([['GT0101', [0]]]),
      cellToMunicipality: ['GT0101'],
      lowCoveragePcodes: [],
    }
    const timelines = buildMunicipalTimelines(ds, assignment)
    const metric = municipalWindowMetric(timelines.get('GT0101')!, 22, SLOTS, 42, 6, { observedYearIndex: 3 })
    expect(metric.relativeDeficitPercent).toBe(0)
    expect(metric.historicalPercentile!).toBeGreaterThan(20)
  })
})
