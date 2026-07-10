import { describe, expect, it } from 'vitest'
import {
  buildLandCoverContextVersion,
  LAND_COVER_AREA_STRATEGY,
  LAND_COVER_BUFFER_UNION_METHOD,
  LAND_COVER_NODATA_POLICY,
} from '@/modules/territory/land-cover/land-cover-context-version'

describe('buildLandCoverContextVersion', () => {
  const base = {
    sourceVersion: '2021-v200',
    rasterHash: 'abc123',
    mapperVersion: 'esa-worldcover-v200-mapper-v1',
    analysisMethodVersion: 'laea-zone-stats-v1',
    zoneRadiiM: [500, 1000, 3000],
  }

  it('is stable for identical inputs', () => {
    const a = buildLandCoverContextVersion(base)
    const b = buildLandCoverContextVersion(base)
    expect(a).toBe(b)
    expect(a).toHaveLength(16)
  })

  it('changes when radii change', () => {
    const a = buildLandCoverContextVersion(base)
    const b = buildLandCoverContextVersion({ ...base, zoneRadiiM: [500, 3000] })
    expect(a).not.toBe(b)
  })

  it('changes when area strategy changes', () => {
    const a = buildLandCoverContextVersion(base)
    const b = buildLandCoverContextVersion({
      ...base,
      areaStrategy: 'warp-on-demand',
    })
    expect(a).not.toBe(b)
  })

  it('includes defaults in hash material', () => {
    const withDefaults = buildLandCoverContextVersion(base)
    const explicit = buildLandCoverContextVersion({
      ...base,
      nodataPolicy: LAND_COVER_NODATA_POLICY,
      areaStrategy: LAND_COVER_AREA_STRATEGY,
      bufferUnionMethod: LAND_COVER_BUFFER_UNION_METHOD,
    })
    expect(withDefaults).toBe(explicit)
  })
})
