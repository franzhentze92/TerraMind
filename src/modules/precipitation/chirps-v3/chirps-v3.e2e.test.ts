/**
 * CHIRPS v3 — REAL end-to-end smoke test (opt-in, no fixtures).
 *
 * Downloads ONE known historical pentad from the official server, opens it with
 * GDAL, clips to Guatemala, normalizes observations and runs the pipeline
 * dry-run. Skips cleanly when GDAL is unavailable or the network is blocked, so
 * CI without connectivity is never red. Enable explicitly with:
 *   CHIRPS_E2E=1 npx vitest run chirps-v3.e2e
 */
import { describe, expect, it, beforeAll } from 'vitest'
import { rmSync } from 'node:fs'
import { toPentadRef } from '@/modules/precipitation/chirps-v3/chirps-pentad.calendar'
import {
  downloadChirpsPentadTif,
  probeChirpsUrl,
} from '@/modules/precipitation/chirps-v3/chirps-v3.download'
import { readChirpsGridFromTif, isGdalAvailable } from '@/modules/precipitation/chirps-v3/chirps-v3.raster'
import { chirpsPentadTifUrl } from '@/modules/precipitation/chirps-v3/chirps-v3.urls'
import { normalizeGridToObservations } from '@/modules/precipitation/chirps-v3/chirps-v3.observations'
import { runDetectionPipeline } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.pipeline'
import { EVENTS_PATH } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.store'

const ENABLED = process.env.CHIRPS_E2E === '1'
const ref = toPentadRef(2020, 5, 3)
const url = chirpsPentadTifUrl(ref, 'final')

describe.skipIf(!ENABLED)('CHIRPS v3 real end-to-end (opt-in)', () => {
  let reachable = false
  let gdalOk = false

  beforeAll(async () => {
    gdalOk = await isGdalAvailable()
    reachable = (await probeChirpsUrl(url)).ok
  })

  it('downloads, opens, clips Guatemala, normalizes and dry-runs', async () => {
    if (!gdalOk || !reachable) {
      console.warn(`[chirps e2e] skipped: gdal=${gdalOk} reachable=${reachable}`)
      return
    }
    const dl = await downloadChirpsPentadTif(ref, 'final', { force: true })
    expect(dl.sizeBytes).toBeGreaterThan(100_000)
    expect(dl.sha256).toHaveLength(64)

    const grid = await readChirpsGridFromTif(dl.path, {
      variant: 'final',
      pentadKey: '2020-5-3',
      sourceUrl: url,
      checksum: dl.sha256,
    })
    const valid = grid.cells.filter((c) => !c.isNoData)
    expect(grid.cells.length).toBeGreaterThan(1000)
    expect(valid.length).toBeGreaterThan(0)

    const observations = normalizeGridToObservations(grid, ref, 'final')
    expect(observations.length).toBe(valid.length)
    expect(observations.every((o) => Number.isFinite(o.attributes.precipitationMm))).toBe(true)
    expect(new Set(observations.map((o) => o.id)).size).toBe(observations.length)

    // Clean any prior productive store so this remains a dry-run signal check.
    rmSync(EVENTS_PATH, { force: true })
    const pipe = runDetectionPipeline({
      observations,
      existingEvents: [],
      cellConsecutive: {},
      endDate: new Date(ref.periodEnd),
    })
    // One pentad without baseline must not fabricate events.
    expect(pipe.events.length).toBe(0)
  }, 120_000)
})
