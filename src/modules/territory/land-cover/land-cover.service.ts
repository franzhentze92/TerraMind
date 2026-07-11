import {
  buildLandCoverContextVersion,
  LAND_COVER_AREA_STRATEGY,
  LAND_COVER_BUFFER_UNION_METHOD,
  LAND_COVER_NODATA_POLICY,
} from '@/modules/territory/land-cover/land-cover-context-version'
import type {
  AnalyzeBuffersInput,
  AnalyzeGeometryInput,
  LandCoverAnalysis,
  LandCoverBufferResult,
  LandCoverContextStatus,
  LandCoverDistribution,
  LandCoverPointSample,
  LandCoverSourceStatus,
  LandCoverWarningCode,
  SamplePointsInput,
} from '@/modules/territory/land-cover/land-cover.types'
import {
  collectPointWarnings,
  collectZoneWarnings,
} from '@/modules/territory/land-cover/land-cover-warnings'
import { isValidAnalysisGeometry } from '@/modules/territory/land-cover/raster/raster-geometry'
import {
  createRasterEngine,
  type LandCoverRasterEngine,
} from '@/modules/territory/land-cover/raster/land-cover-raster-engine'
import {
  ESA_WORLDCOVER_ANALYSIS_METHOD_VERSION,
  ESA_WORLDCOVER_LAYER_CODE,
  ESA_WORLDCOVER_REFERENCE_YEAR,
  ESA_WORLDCOVER_SOURCE_VERSION,
} from '@/modules/territory/land-cover/providers/esa-worldcover/esa-worldcover.manifest'
import { ESA_WORLDCOVER_MAPPER_VERSION } from '@/modules/territory/land-cover/providers/esa-worldcover/esa-worldcover.mapper'

export interface LandCoverService {
  getSourceStatus(): Promise<LandCoverSourceStatus>
  samplePoints(input: SamplePointsInput): Promise<LandCoverPointSample[]>
  analyzeGeometry(input: AnalyzeGeometryInput): Promise<LandCoverDistribution>
  analyzeBuffers(input: AnalyzeBuffersInput): Promise<LandCoverAnalysis>
}

export class LandCoverServiceNotReadyError extends Error {
  constructor(message = 'LandCoverService: raster no preparado.') {
    super(message)
    this.name = 'LandCoverServiceNotReadyError'
  }
}

export class LandCoverServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LandCoverServiceError'
  }
}

export interface LandCoverServiceOptions {
  rasterEngine?: LandCoverRasterEngine
}

function resolveStatus(warnings: LandCoverWarningCode[]): LandCoverContextStatus {
  if (warnings.includes('source_unavailable') || warnings.includes('raster_hash_mismatch')) {
    return 'unavailable'
  }
  if (
    warnings.includes('raster_processing_failed') ||
    warnings.includes('invalid_geometry')
  ) {
    return 'error'
  }
  if (
    warnings.includes('point_nodata') ||
    warnings.includes('point_outside_coverage') ||
    warnings.includes('incomplete_zone_coverage')
  ) {
    return 'partial'
  }
  return 'complete'
}

export function createLandCoverService(
  options: LandCoverServiceOptions = {},
): LandCoverService {
  const raster = options.rasterEngine ?? createRasterEngine()

  return {
    async getSourceStatus() {
      return raster.getSourceStatus()
    },

    async samplePoints(input) {
      try {
        await raster.ensureReady()
        return raster.samplePoints(input.points)
      } catch (error) {
        throw error instanceof LandCoverServiceNotReadyError
          ? error
          : new LandCoverServiceError(
              error instanceof Error ? error.message : 'Error muestreando puntos',
            )
      }
    },

    async analyzeGeometry(input) {
      if (!isValidAnalysisGeometry(input.geometry)) {
        throw new LandCoverServiceError('invalid_geometry')
      }
      try {
        await raster.ensureReady()
        return raster.analyzeGeometry(input)
      } catch (error) {
        if (error instanceof LandCoverServiceError) throw error
        throw new LandCoverServiceError(
          error instanceof Error ? error.message : 'Error analizando geometría',
        )
      }
    },

    async analyzeBuffers(input) {
      const warnings: LandCoverWarningCode[] = []
      const statusInfo = await raster.getSourceStatus()
      if (!statusInfo.available) {
        warnings.push('source_unavailable')
        return emptyAnalysis(input, warnings)
      }
      if (statusInfo.sourceCogSha256 == null) {
        warnings.push('raster_hash_mismatch')
        return emptyAnalysis(input, warnings)
      }

      try {
        await raster.ensureReady()
        const pointSamples = await raster.samplePoints(input.points)
        const pointDistribution = raster.pointDistributionFromSamples(pointSamples)
        const pointWarnings = collectPointWarnings({
          nodataCount: pointSamples.filter((s) => s.nodata).length,
          outsideCount: pointSamples.filter((s) => s.outsideCoverage).length,
          dominantClasses: new Set(
            pointSamples
              .filter((s) => !s.nodata)
              .map((s) => s.internalClass),
          ),
          referenceYear: ESA_WORLDCOVER_REFERENCE_YEAR,
        })
        for (const w of pointWarnings) warnings.push(w.code)

        const zones = await raster.analyzeBuffers(input)
        const zoneResults: LandCoverBufferResult[] = zones.map((zone) => {
          const zoneWarnings = collectZoneWarnings({
            dataCoveragePct: zone.distribution.dataCoveragePct,
          })
          for (const w of zoneWarnings) warnings.push(w.code)
          return {
            radiusM: zone.radiusM,
            geometryMethod: zone.geometryMethod,
            distribution: zone.distribution,
          }
        })

        const contextVersion = buildLandCoverContextVersion({
          sourceVersion: ESA_WORLDCOVER_SOURCE_VERSION,
          rasterHash: statusInfo.analyticCogSha256 ?? statusInfo.sourceCogSha256!,
          mapperVersion: statusInfo.mapperVersion ?? ESA_WORLDCOVER_MAPPER_VERSION,
          analysisMethodVersion:
            statusInfo.analysisMethodVersion ?? ESA_WORLDCOVER_ANALYSIS_METHOD_VERSION,
          zoneRadiiM: input.radiiMeters,
          nodataPolicy: LAND_COVER_NODATA_POLICY,
          areaStrategy: LAND_COVER_AREA_STRATEGY,
          bufferUnionMethod: LAND_COVER_BUFFER_UNION_METHOD,
        })

        const uniqueWarnings = [...new Set(warnings)]
        return {
          source: ESA_WORLDCOVER_LAYER_CODE,
          sourceVersion: ESA_WORLDCOVER_SOURCE_VERSION,
          sourceYear: ESA_WORLDCOVER_REFERENCE_YEAR,
          rasterHash: statusInfo.analyticCogSha256 ?? statusInfo.sourceCogSha256!,
          mapperVersion: statusInfo.mapperVersion ?? ESA_WORLDCOVER_MAPPER_VERSION,
          analysisMethodVersion:
            statusInfo.analysisMethodVersion ?? ESA_WORLDCOVER_ANALYSIS_METHOD_VERSION,
          contextVersion,
          pointDistribution,
          pointSamples,
          zones: zoneResults,
          warnings: uniqueWarnings,
          status: resolveStatus(uniqueWarnings),
          generatedAt: new Date().toISOString(),
        }
      } catch (error) {
        warnings.push('raster_processing_failed')
        const fallback = emptyAnalysis(input, warnings)
        return {
          ...fallback,
          status: 'error',
        }
      }
    },
  }
}

function emptyAnalysis(
  input: AnalyzeBuffersInput,
  warnings: LandCoverWarningCode[],
): LandCoverAnalysis {
  const uniqueWarnings = [...new Set(warnings)]
  return {
    source: ESA_WORLDCOVER_LAYER_CODE,
    sourceVersion: ESA_WORLDCOVER_SOURCE_VERSION,
    sourceYear: ESA_WORLDCOVER_REFERENCE_YEAR,
    rasterHash: '',
    mapperVersion: ESA_WORLDCOVER_MAPPER_VERSION,
    analysisMethodVersion: ESA_WORLDCOVER_ANALYSIS_METHOD_VERSION,
    contextVersion: buildLandCoverContextVersion({
      sourceVersion: ESA_WORLDCOVER_SOURCE_VERSION,
      rasterHash: 'unavailable',
      mapperVersion: ESA_WORLDCOVER_MAPPER_VERSION,
      analysisMethodVersion: ESA_WORLDCOVER_ANALYSIS_METHOD_VERSION,
      zoneRadiiM: input.radiiMeters,
    }),
    pointDistribution: {
      dominantClass: null,
      classDistribution: [],
      validPixelCount: 0,
      nodataPixelCount: 0,
      dataCoveragePct: 0,
      analyzedAreaHa: 0,
    },
    pointSamples: [],
    zones: [],
    warnings: uniqueWarnings,
    status: resolveStatus(uniqueWarnings),
    generatedAt: new Date().toISOString(),
  }
}
