/**
 * CHIRPS v3 — download idempotency tests.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  CHIRPS_DATA_ROOT,
  CHIRPS_MANIFEST_PATH,
  loadChirpsManifest,
  localRawPath,
  saveChirpsManifest,
} from '@/modules/precipitation/chirps-v3/chirps-v3.download'
import { toPentadRef } from '@/modules/precipitation/chirps-v3/chirps-pentad.calendar'
import { chirpsPentadTifUrl } from '@/modules/precipitation/chirps-v3/chirps-v3.urls'

describe('CHIRPS v3 download manifest', () => {
  beforeEach(() => {
    if (existsSync(CHIRPS_DATA_ROOT)) rmSync(CHIRPS_DATA_ROOT, { recursive: true, force: true })
    mkdirSync(CHIRPS_DATA_ROOT, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(CHIRPS_DATA_ROOT)) rmSync(CHIRPS_DATA_ROOT, { recursive: true, force: true })
  })

  it('builds official final pentad URL', () => {
    const ref = toPentadRef(2020, 5, 3)
    const url = chirpsPentadTifUrl(ref, 'final')
    expect(url).toContain('CHIRPS/v3.0/pentads/latam/tifs/')
    expect(url).toContain('chirps-v3.0.2020.05.3.tif')
  })

  it('builds preliminary URL separately from final', () => {
    const ref = toPentadRef(2025, 1, 1)
    const prelim = chirpsPentadTifUrl(ref, 'preliminary')
    const fin = chirpsPentadTifUrl(ref, 'final')
    expect(prelim).toContain('/prelim/pentads/')
    expect(fin).not.toContain('/prelim/')
  })

  it('persists manifest entries idempotently', () => {
    const ref = toPentadRef(2019, 4, 2)
    const path = localRawPath(ref, 'final')
    mkdirSync(resolve(path, '..'), { recursive: true })
    writeFileSync(path, Buffer.alloc(200_000, 1))
    saveChirpsManifest({
      version: 1,
      processingVersion: 'test',
      products: [
        {
          productId: 'chirps_v3_final_2019_4_2',
          variant: 'final',
          year: 2019,
          month: 4,
          pentad: 2,
          url: chirpsPentadTifUrl(ref, 'final'),
          localPath: path,
          sha256: 'abc',
          sizeBytes: 200_000,
          downloadedAt: new Date().toISOString(),
          processingVersion: 'test',
        },
      ],
    })
    const manifest = loadChirpsManifest()
    expect(manifest.products).toHaveLength(1)
    expect(existsSync(CHIRPS_MANIFEST_PATH)).toBe(true)
  })
})
