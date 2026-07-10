import { describe, expect, it, vi } from 'vitest'

import { POPULATION_SPATIAL_DISCLAIMER } from '@/modules/territory/population/population-disclaimer'
import {
  createPopulationService,
  PopulationServiceError,
  PopulationServiceNotReadyError,
} from '@/modules/territory/population/population.service'
import type { PopulationRasterEngine } from '@/modules/territory/population/raster/population-raster-engine'

const mockSum = {
  populationSum: 12_345,
  validPixelCount: 100,
  nodataPixelCount: 0,
  negativePixelCount: 0,
  nonFinitePixelCount: 0,
  dataCoveragePct: 100,
  analyzedAreaHa: 78.5,
  densityPerKm2: 157.3,
  pixelAreaM2: 10_000,
}

function mockEngine(overrides: Partial<PopulationRasterEngine> = {}): PopulationRasterEngine {
  return {
    resolveStrategy: vi.fn().mockReturnValue('laea-direct'),
    resolveRasterPath: vi.fn().mockReturnValue({
      path: 'mock.tif',
      strategy: 'laea-direct',
      crs: 'LAEA-GT',
    }),
    ensureVariantReady: vi.fn().mockResolvedValue([]),
    getMetadata: vi.fn(),
    samplePoint: vi.fn().mockResolvedValue({
      latitude: 14.63,
      longitude: -90.5,
      populationCellEstimate: 42.5,
      estimateRounded: 43,
      nodata: false,
      outsideCoverage: false,
    }),
    analyzeGeometry: vi.fn().mockResolvedValue({ result: mockSum, warnings: [] }),
    analyzeBuffers: vi.fn().mockResolvedValue([
      { radiusM: 500, result: mockSum, warnings: [] },
      { radiusM: 1000, result: { ...mockSum, populationSum: 20_000 }, warnings: [] },
    ]),
    getProductMeta: vi.fn(),
    ...overrides,
  } as unknown as PopulationRasterEngine
}

vi.mock('@/modules/territory/population/processing/source-status', () => ({
  getLocalPopulationSourceStatus: vi.fn().mockResolvedValue({
    sourceCode: 'worldpop',
    name: 'WorldPop',
    isReady: true,
    isOfficial: false,
    referenceYear: 2020,
    sourceVersion: 'R2025A-v1',
    spatialResolutionM: 100,
    semantics: 'modelled_spatial_population',
    rasterHash: 'abc123',
    validationRasterHash: 'def456',
    warnings: [],
    filesAvailable: true,
    checksumValid: true,
    cogValid: true,
    variants: [
      {
        variant: 'constrained',
        laeaApproved: true,
        wgs84CogAvailable: true,
        checksumValid: true,
      },
      {
        variant: 'unconstrained',
        laeaApproved: true,
        wgs84CogAvailable: true,
        checksumValid: true,
      },
    ],
    totalPopulation: 17_223_237,
    generatedAt: '2026-07-10T00:00:00.000Z',
  }),
}))

describe('PopulationService (7D.1B)', () => {
  it('returns operational source status', async () => {
    const service = createPopulationService({ rasterEngine: mockEngine() })
    const status = await service.getSourceStatus()
    expect(status.operationalHealth).toBe('healthy')
    expect(status.primaryVariant).toBe('constrained')
    expect(status.validationVariant).toBe('unconstrained')
  })

  it('samplePoint returns populationCellEstimate', async () => {
    const service = createPopulationService({ rasterEngine: mockEngine() })
    const sample = await service.samplePoint({ latitude: 14.63, longitude: -90.5 })
    expect(sample.populationCellEstimate).toBe(42.5)
    expect(sample.estimateRounded).toBe(43)
    expect(sample.warnings.some((w) => w.code === 'resolution_limit')).toBe(true)
  })

  it('analyzeBuffers returns sorted radii and estimates', async () => {
    const service = createPopulationService({ rasterEngine: mockEngine() })
    const result = await service.analyzeBuffers({
      points: [{ lat: 14.63, lon: -90.5 }],
      radiiMeters: [1000, 500],
    })
    expect(result.buffers.map((b) => b.radiusM)).toEqual([500, 1000])
    expect(result.buffers[0]?.estimatedPopulation).toBe(12_345)
    expect(result.disclaimer).toBe(POPULATION_SPATIAL_DISCLAIMER)
    expect(result.generatedAt).toBeTruthy()
  })

  it('rejects invalid radii', async () => {
    const service = createPopulationService({ rasterEngine: mockEngine() })
    await expect(
      service.analyzeBuffers({
        points: [{ lat: 14.63, lon: -90.5 }],
        radiiMeters: [0],
      }),
    ).rejects.toBeInstanceOf(PopulationServiceError)
  })

  it('compareVariants uses both models', async () => {
    const engine = mockEngine({
      analyzeGeometry: vi
        .fn()
        .mockResolvedValueOnce({ result: { ...mockSum, populationSum: 1000 }, warnings: [] })
        .mockResolvedValueOnce({ result: { ...mockSum, populationSum: 1300 }, warnings: [] }),
    })
    const service = createPopulationService({ rasterEngine: engine })
    const comparison = await service.compareVariants({
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-90.51, 14.63],
            [-90.5, 14.63],
            [-90.5, 14.64],
            [-90.51, 14.64],
            [-90.51, 14.63],
          ],
        ],
      },
    })
    expect(comparison.percentageDifference).toBe(30)
  })

  it('getAdministrativeContext returns INE data when available', async () => {
    const service = createPopulationService({ rasterEngine: mockEngine() })
    const ctx = await service.getAdministrativeContext({ departmentCode: '13', referenceYear: 2020 })
    expect(ctx.status).toBe('available')
    expect(ctx.department?.adminName).toMatch(/Huehuetenango/i)
    expect(ctx.semantics).toBe('official_administrative_population')
  })

  it('getNearestSettlements returns ranked settlements', async () => {
    const service = createPopulationService({ rasterEngine: mockEngine() })
    const settlements = await service.getNearestSettlements({
      geometry: { type: 'Point', coordinates: [-91.4761, 15.3147] },
      limit: 3,
    })
    expect(settlements.length).toBeGreaterThan(0)
    expect(settlements[0]?.distanceM).toBeGreaterThanOrEqual(0)
  })
})
