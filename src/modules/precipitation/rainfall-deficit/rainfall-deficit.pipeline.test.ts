/**
 * Tests — rainfall deficit pipeline (historical validation fixtures).
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'node:fs'

import { normalizeGridToObservations } from '@/modules/precipitation/chirps-v3/chirps-v3.observations'
import { gridFromCells } from '@/modules/precipitation/chirps-v3/chirps-v3.raster'
import { toPentadRef } from '@/modules/precipitation/chirps-v3/chirps-pentad.calendar'
import { runDetectionPipeline } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.pipeline'
import { EVENTS_PATH, RAINFALL_DEFICIT_STORE_ROOT } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.store'
import type { ChirpsGridCell } from '@/modules/precipitation/chirps-v3/chirps-grid.types'

function makeObservationsForPentads(
  pentads: Array<{ ref: ReturnType<typeof toPentadRef>; mmByCell: Record<string, number> }>,
  variant: 'final' | 'preliminary' = 'final',
) {
  const all = []
  for (const p of pentads) {
    const cells: ChirpsGridCell[] = Object.entries(p.mmByCell).map(([key, mm]) => {
      const [row, col] = key.split(',').map(Number)
      return { row: row!, col: col!, lat: 15, lon: -90, precipitationMm: mm, isNoData: false }
    })
    const grid = gridFromCells(cells, {
      variant,
      pentadKey: `${p.ref.year}-${p.ref.month}-${p.ref.pentad}`,
      sourceUrl: 'fixture://test',
    })
    all.push(...normalizeGridToObservations(grid, p.ref, variant))
  }
  return all
}

describe('rainfall deficit pipeline', () => {
  beforeEach(() => {
    if (existsSync(RAINFALL_DEFICIT_STORE_ROOT)) {
      rmSync(RAINFALL_DEFICIT_STORE_ROOT, { recursive: true, force: true })
    }
    mkdirSync(RAINFALL_DEFICIT_STORE_ROOT, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(EVENTS_PATH)) rmSync(EVENTS_PATH, { force: true })
  })

  it('does not create events for normal dry season (low expected, high percentile)', () => {
    const refs = [1, 2, 3, 4, 5, 6].map((p) => toPentadRef(2024, 3, p))
    const obs = makeObservationsForPentads(
      refs.map((ref) => ({ ref, mmByCell: { '0,0': 2, '0,1': 2, '1,0': 2, '1,1': 2 } })),
    )
    const { events } = runDetectionPipeline({
      observations: obs,
      existingEvents: [],
      cellConsecutive: {},
      endDate: new Date('2024-03-31'),
    })
    expect(events.length).toBe(0)
  })

  it('creates event cluster for real deficit', () => {
    const refs = [1, 2, 3, 4, 5, 6].map((p) => toPentadRef(2024, 5, p))
    const obs = makeObservationsForPentads(
      refs.map((ref) => ({ ref, mmByCell: { '0,0': 5, '0,1': 5, '1,0': 5, '1,1': 5 } })),
    )
    // Add historical baseline pentads (1991-2020 same slots) with high rainfall
    const histRefs = []
    for (let y = 1991; y <= 2020; y++) {
      for (const p of [1, 2, 3, 4, 5, 6]) {
        histRefs.push(toPentadRef(y, 5, p))
      }
    }
    const histObs = makeObservationsForPentads(
      histRefs.map((ref) => ({ ref, mmByCell: { '0,0': 25, '0,1': 25, '1,0': 25, '1,1': 25 } })),
    )
    const { events } = runDetectionPipeline({
      observations: [...histObs, ...obs],
      existingEvents: [],
      cellConsecutive: { '0,0': 2, '0,1': 2, '1,0': 2, '1,1': 2 },
      endDate: new Date('2024-05-31'),
    })
    expect(events.length).toBeGreaterThan(0)
    expect(events[0]!.attributes.windows.days30.relativeDeficitPercent).toBeGreaterThan(30)
  })

  it('is idempotent on replay', () => {
    const ref = toPentadRef(2024, 6, 1)
    const obs = makeObservationsForPentads([{ ref, mmByCell: { '0,0': 10 } }])
    const first = runDetectionPipeline({
      observations: obs,
      existingEvents: [],
      cellConsecutive: {},
      endDate: new Date('2024-06-05'),
    })
    const second = runDetectionPipeline({
      observations: obs,
      existingEvents: first.events,
      cellConsecutive: first.nextConsecutive,
      endDate: new Date('2024-06-05'),
    })
    expect(second.events.length).toBe(first.events.length)
  })
})
