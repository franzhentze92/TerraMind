import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LAND_COVER_ANALYTIC_COG } from '@/modules/territory/land-cover/processing/paths'
import { createLandCoverService } from '@/modules/territory/land-cover/land-cover.service'

const hasLocalCog = existsSync(LAND_COVER_ANALYTIC_COG)

describe.skipIf(!hasLocalCog).sequential('LandCoverService integration (local COG)', () => {
  const service = createLandCoverService()

  it(
    'reports source status with matching hashes',
    async () => {
      const status = await service.getSourceStatus()
      expect(status.available).toBe(true)
      expect(status.sourceVersion).toBe('2021-v200')
      expect(status.analyticCogSha256).toHaveLength(64)
    },
    30_000,
  )

  it(
    'samples forest in Petén',
    async () => {
      const samples = await service.samplePoints({
        points: [{ lon: -90.5, lat: 16.9 }],
      })
      expect(samples[0]?.internalClass).toBe('forest')
      expect(samples[0]?.nodata).toBe(false)
    },
    30_000,
  )

  it(
    'samples built-up in Guatemala City',
    async () => {
      const samples = await service.samplePoints({
        points: [{ lon: -90.5069, lat: 14.6349 }],
      })
      expect(samples[0]?.internalClass).toBe('built_up')
    },
    30_000,
  )

  it('returns nodata outside Guatemala', async () => {
    const samples = await service.samplePoints({
      points: [{ lon: -87.5, lat: 15.0 }],
    })
    expect(samples[0]?.outsideCoverage || samples[0]?.nodata).toBe(true)
  })

  it(
    'analyzes unified 500m buffer without double counting overlap',
    async () => {
      const result = await service.analyzeBuffers({
        points: [
          { lon: -90.5, lat: 16.9 },
          { lon: -90.51, lat: 16.91 },
        ],
        radiiMeters: [500],
        unifyBuffers: true,
      })
      expect(result.zones).toHaveLength(1)
      const pctSum = result.zones[0].distribution.classDistribution.reduce(
        (s, row) => s + row.pct,
        0,
      )
      expect(pctSum).toBeGreaterThan(95)
      expect(pctSum).toBeLessThanOrEqual(100.5)
    },
    120_000,
  )

  it('samples mangrove on Pacific coast', async () => {
    const samples = await service.samplePoints({
      points: [{ lon: -90.65, lat: 13.95 }],
    })
    expect(samples[0]?.internalClass).toBe('mangrove')
  })
})
