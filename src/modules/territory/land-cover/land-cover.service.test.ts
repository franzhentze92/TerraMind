import { describe, expect, it } from 'vitest'
import {
  createLandCoverService,
  LandCoverServiceError,
} from '@/modules/territory/land-cover/land-cover.service'
import type { LandCoverRasterEngine } from '@/modules/territory/land-cover/raster/land-cover-raster-engine'

function mockEngine(partial: Partial<LandCoverRasterEngine>): LandCoverRasterEngine {
  return partial as LandCoverRasterEngine
}

describe('LandCoverService (unit)', () => {
  it('returns unavailable when raster is missing', async () => {
    const service = createLandCoverService({
      rasterEngine: mockEngine({
        getSourceStatus: async () => ({
          available: false,
          source: null,
          sourceVersion: null,
          sourceYear: null,
          sourceCogPath: null,
          analyticCogPath: null,
          sourceCogSha256: null,
          analyticCogSha256: null,
          mapperVersion: null,
          analysisMethodVersion: null,
          areaStrategy: null,
          gdalVersion: null,
        }),
      }),
    })

    const result = await service.analyzeBuffers({
      points: [{ lon: -90.5, lat: 16.9 }],
      radiiMeters: [500],
    })
    expect(result.status).toBe('unavailable')
    expect(result.warnings).toContain('source_unavailable')
  })

  it('builds analysis with zones and context version', async () => {
    const service = createLandCoverService({
      rasterEngine: mockEngine({
        getSourceStatus: async () => ({
          available: true,
          source: 'gt_land_cover',
          sourceVersion: '2021-v200',
          sourceYear: 2021,
          sourceCogPath: '/tmp/source.tif',
          analyticCogPath: '/tmp/laea.tif',
          sourceCogSha256: 'source-hash',
          analyticCogSha256: 'laea-hash',
          mapperVersion: 'esa-worldcover-v200-mapper-v1',
          analysisMethodVersion: 'laea-zone-stats-v1',
          areaStrategy: 'laea-analytic-cog',
          gdalVersion: 'GDAL 3.10.0',
        }),
        ensureReady: async () => {},
        samplePoints: async () => [
          {
            latitude: 16.9,
            longitude: -90.5,
            providerClassCode: 10,
            providerClassName: 'Tree cover',
            internalClass: 'forest',
            nodata: false,
            outsideCoverage: false,
          },
        ],
        analyzeBuffers: async () => [
          {
            radiusM: 500,
            geometryMethod: 'unified_buffer_union',
            distribution: {
              dominantClass: 'forest',
              classDistribution: [
                {
                  internalClass: 'forest',
                  providerClassCode: 10,
                  count: 100,
                  pct: 100,
                },
              ],
              validPixelCount: 100,
              nodataPixelCount: 0,
              dataCoveragePct: 100,
              analyzedAreaHa: 78.5,
            },
          },
        ],
        pointDistributionFromSamples: () => ({
          dominantClass: 'forest',
          classDistribution: [
            {
              internalClass: 'forest',
              providerClassCode: 10,
              count: 1,
              pct: 100,
            },
          ],
          validPixelCount: 1,
          nodataPixelCount: 0,
          dataCoveragePct: 100,
          analyzedAreaHa: 0,
        }),
      }),
    })

    const result = await service.analyzeBuffers({
      points: [{ lon: -90.5, lat: 16.9 }],
      radiiMeters: [500],
      unifyBuffers: true,
    })
    expect(result.status).toBe('complete')
    expect(result.zones).toHaveLength(1)
    expect(result.contextVersion).toHaveLength(16)
    expect(result.warnings).toContain('outdated_source_year')
  })

  it('maps invalid geometry to service error', async () => {
    const service = createLandCoverService({
      rasterEngine: mockEngine({
        ensureReady: async () => {},
        analyzeGeometry: async () => {
          throw new Error('Geometría inválida para análisis raster')
        },
      }),
    })

    await expect(
      service.analyzeGeometry({
        geometry: { type: 'Polygon', coordinates: [] },
        geometryCrs: 'EPSG:4326',
      }),
    ).rejects.toBeInstanceOf(LandCoverServiceError)
  })
})
