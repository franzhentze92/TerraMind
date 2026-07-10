import { gdalInfoJson, getToolVersions } from '@/modules/territory/land-cover/processing/gdal'
import {
  LAEA_PROJ4,
  LAND_COVER_ANALYTIC_COG,
  LAND_COVER_SOURCE_COG,
} from '@/modules/territory/land-cover/processing/paths'
import {
  assertRasterArtifactsReady,
  verifyRasterArtifacts,
} from '@/modules/territory/land-cover/raster/raster-artifacts'
import {
  buildMetricBufferUnionGeoJson,
  isValidAnalysisGeometry,
  reprojectGeometryToLaea,
} from '@/modules/territory/land-cover/raster/raster-geometry'
import {
  pointSamplesToDistribution,
  samplePointsFromRaster,
} from '@/modules/territory/land-cover/raster/raster-point-sampler'
import { withRasterTempWorkspace } from '@/modules/territory/land-cover/raster/raster-temp'
import {
  analyzeRasterWindow,
  type RasterReadStrategy,
} from '@/modules/territory/land-cover/raster/raster-zone-analyzer'
import type {
  AnalyzeBuffersInput,
  AnalyzeGeometryInput,
  GeoPoint,
  LandCoverDistribution,
  LandCoverSourceStatus,
} from '@/modules/territory/land-cover/land-cover.types'
import {
  ESA_WORLDCOVER_ANALYSIS_METHOD_VERSION,
  ESA_WORLDCOVER_LAYER_CODE,
  ESA_WORLDCOVER_REFERENCE_YEAR,
  ESA_WORLDCOVER_SOURCE_VERSION,
  loadEsaWorldCoverManifest,
} from '@/modules/territory/land-cover/providers/esa-worldcover/esa-worldcover.manifest'
import { ESA_WORLDCOVER_MAPPER_VERSION } from '@/modules/territory/land-cover/providers/esa-worldcover/esa-worldcover.mapper'
import { LAND_COVER_AREA_STRATEGY } from '@/modules/territory/land-cover/land-cover-context-version'

export interface RasterEngineOptions {
  strategy?: RasterReadStrategy
}

export class LandCoverRasterEngine {
  private metadataCache: Record<string, unknown> | null = null
  private gdalVersion: string | null = null
  private readonly strategy: RasterReadStrategy

  constructor(options: RasterEngineOptions = {}) {
    this.strategy = options.strategy ?? 'laea-direct'
  }

  async getSourceStatus(): Promise<LandCoverSourceStatus> {
    const artifacts = await verifyRasterArtifacts()
    const tools = await getToolVersions()
    const manifest = loadEsaWorldCoverManifest()
    return {
      available:
        artifacts.sourceCogExists &&
        artifacts.analyticCogExists &&
        !artifacts.hashMismatch,
      source: ESA_WORLDCOVER_LAYER_CODE,
      sourceVersion: ESA_WORLDCOVER_SOURCE_VERSION,
      sourceYear: ESA_WORLDCOVER_REFERENCE_YEAR,
      sourceCogPath: LAND_COVER_SOURCE_COG,
      analyticCogPath: LAND_COVER_ANALYTIC_COG,
      sourceCogSha256: artifacts.sourceCogSha256,
      analyticCogSha256: artifacts.analyticCogSha256,
      mapperVersion: manifest.mapper_version ?? ESA_WORLDCOVER_MAPPER_VERSION,
      analysisMethodVersion:
        manifest.analysis_method_version ?? ESA_WORLDCOVER_ANALYSIS_METHOD_VERSION,
      areaStrategy: LAND_COVER_AREA_STRATEGY,
      gdalVersion: tools.gdal,
    }
  }

  async ensureReady(): Promise<void> {
    const status = await verifyRasterArtifacts()
    assertRasterArtifactsReady(status)
    if (!this.gdalVersion) {
      const tools = await getToolVersions()
      this.gdalVersion = tools.gdal
    }
  }

  async getAnalyticMetadata(): Promise<Record<string, unknown>> {
    await this.ensureReady()
    if (!this.metadataCache) {
      this.metadataCache = await gdalInfoJson(LAND_COVER_ANALYTIC_COG)
    }
    return this.metadataCache
  }

  async samplePoints(points: GeoPoint[]) {
    await this.ensureReady()
    return samplePointsFromRaster(LAND_COVER_SOURCE_COG, points)
  }

  async analyzeGeometry(input: AnalyzeGeometryInput): Promise<LandCoverDistribution> {
    if (!isValidAnalysisGeometry(input.geometry)) {
      throw new Error('Geometría inválida para análisis raster')
    }
    await this.ensureReady()
    return withRasterTempWorkspace(async (ws) => {
      const cutlinePath =
        input.geometryCrs === 'LAEA-GT'
          ? ws.path('geometry_laea.geojson')
          : await reprojectGeometryToLaea(input.geometry, ws.dir)
      if (input.geometryCrs === 'LAEA-GT') {
        const { writeFileSync } = await import('node:fs')
        writeFileSync(
          cutlinePath,
          `${JSON.stringify({
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: input.geometry, properties: {} }],
          })}\n`,
          'utf8',
        )
      }
      return analyzeRasterWindow({
        strategy: this.strategy,
        source4326Path: LAND_COVER_SOURCE_COG,
        laeaPath: LAND_COVER_ANALYTIC_COG,
        cutlinePath,
        cutlineSrs: LAEA_PROJ4,
        clipOutputPath: ws.path('geometry_clip.tif'),
      })
    })
  }

  async analyzeBuffers(input: AnalyzeBuffersInput): Promise<
    Array<{
      radiusM: number
      geometryMethod: 'unified_buffer_union' | 'single_buffer'
      distribution: LandCoverDistribution
    }>
  > {
    await this.ensureReady()
    if (input.points.length === 0) return []

    return withRasterTempWorkspace(async (ws) => {
      const results: Array<{
        radiusM: number
        geometryMethod: 'unified_buffer_union' | 'single_buffer'
        distribution: LandCoverDistribution
      }> = []

      for (const radiusM of input.radiiMeters) {
        const unify = input.unifyBuffers ?? true
        const unionPath = ws.path(`buffer_${radiusM}m.geojson`)
        await buildMetricBufferUnionGeoJson({
          points: input.points,
          radiusM,
          pointsWgs84Path: ws.path(`points_${radiusM}_wgs84.geojson`),
          pointsLaeaPath: ws.path(`points_${radiusM}_laea.geojson`),
          unionPath,
          unify,
        })
        const distribution = await analyzeRasterWindow({
          strategy: this.strategy,
          source4326Path: LAND_COVER_SOURCE_COG,
          laeaPath: LAND_COVER_ANALYTIC_COG,
          cutlinePath: unionPath,
          cutlineSrs: LAEA_PROJ4,
          clipOutputPath: ws.path(`buffer_${radiusM}_clip.tif`),
        })
        results.push({
          radiusM,
          geometryMethod: unify ? 'unified_buffer_union' : 'single_buffer',
          distribution,
        })
      }
      return results
    })
  }

  pointDistributionFromSamples(samples: Awaited<ReturnType<typeof samplePointsFromRaster>>) {
    return pointSamplesToDistribution(samples)
  }
}

export function createRasterEngine(options?: RasterEngineOptions): LandCoverRasterEngine {
  return new LandCoverRasterEngine(options)
}
