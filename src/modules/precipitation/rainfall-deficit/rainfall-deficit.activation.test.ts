/**
 * Tests — activation readiness + municipal context enrichment.
 */
import { describe, expect, it } from 'vitest'
import { resolveActivationReadiness } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.activation'
import {
  buildMunicipalContext,
  municipalitiesForCells,
} from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.municipal-context'
import type { ClimatologyGrid } from '@/modules/precipitation/chirps-v3/chirps-climatology.store'

function syntheticGtGrid(): ClimatologyGrid {
  const cells: ClimatologyGrid['cells'] = []
  let row = 0
  for (let lat = 13.7; lat <= 17.8; lat += 0.1) {
    let col = 0
    for (let lon = -92.3; lon <= -88.2; lon += 0.1) {
      cells.push({ row, col, lat, lon })
      col++
    }
    row++
  }
  return {
    rows: row,
    cols: Math.ceil((-88.2 - -92.3) / 0.1) + 1,
    cellCount: cells.length,
    bbox: [-92.3, 13.7, -88.2, 17.8],
    resolutionDeg: 0.1,
    cells,
  }
}

describe('activation readiness', () => {
  it('reports a structured readiness result with checks', () => {
    const readiness = resolveActivationReadiness()
    expect(Array.isArray(readiness.checks)).toBe(true)
    expect(readiness.checks.length).toBeGreaterThan(0)
    // Municipal layer must always be verifiable.
    expect(readiness.summary.municipalitiesTotal).toBeGreaterThanOrEqual(340)
    // `ready` is boolean regardless of whether climatology is built.
    expect(typeof readiness.ready).toBe('boolean')
  })
})

describe('municipal context', () => {
  const grid = syntheticGtGrid()
  const ctx = buildMunicipalContext(grid)

  it('maps grid cells to municipalities with readable labels', () => {
    expect(ctx.cellKeyToPcode.size).toBeGreaterThan(0)
    const anyPcode = [...ctx.pcodeToLabel.keys()][0]!
    expect(ctx.pcodeToLabel.get(anyPcode)).toContain(',')
  })

  it('aggregates municipalities and departments for a cell set', () => {
    const someCells = grid.cells.slice(0, 200).map((c) => ({ row: c.row, col: c.col }))
    const agg = municipalitiesForCells(ctx, someCells)
    expect(agg.municipalityCount).toBeGreaterThan(0)
    expect(agg.departmentCount).toBeGreaterThan(0)
    expect(agg.names.length).toBe(agg.municipalityCount)
    // names sorted
    const sorted = [...agg.names].sort((a, b) => a.localeCompare(b))
    expect(agg.names).toEqual(sorted)
  })
})
