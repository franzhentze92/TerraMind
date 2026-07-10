import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import {
  buildMetricBufferUnionGeoJson,
  isValidAnalysisGeometry,
  reprojectGeometryToLaea,
} from '@/modules/territory/land-cover/raster/raster-geometry'
import { withRasterTempWorkspace } from '@/modules/territory/land-cover/raster/raster-temp'
import { runCommand } from '@/modules/territory/population/processing/gdal'
import { loadPopulationManifest } from '@/modules/territory/population/processing/manifest-io'
import { sumPopulationAtCutline } from '@/modules/territory/population/processing/raster-cutline-sum'
import {
  LAEA_PROJ4,
  processedLaeaCog,
  processedWgs84Cog,
} from '@/modules/territory/population/processing/paths'
import { inspectPopulationRaster } from '@/modules/territory/population/processing/raster-stats'
import { samplePopulationCell } from '@/modules/territory/population/raster/population-point-sampler'
import type { PopulationCutlineSumResult } from '@/modules/territory/population/processing/raster-cutline-sum'
import type {
  AnalyzeBuffersInput,
  GeoPoint,
  PopulationGeometryCrs,
  PopulationWarning,
} from '@/modules/territory/population/population.types'
import { populationWarning } from '@/modules/territory/population/population-warnings'
import type { WorldPopVariant } from '@/modules/territory/population/providers/worldpop/worldpop-products'
import { getWorldPopProduct } from '@/modules/territory/population/providers/worldpop/worldpop-products'

export type PopulationRasterStrategy = 'laea-direct' | 'wgs84-fallback'

export interface PopulationRasterEngineOptions {
  strategy?: PopulationRasterStrategy
}

export class PopulationRasterEngine {
  private readonly preferredStrategy: PopulationRasterStrategy
  private metadataCache = new Map<string, Awaited<ReturnType<typeof inspectPopulationRaster>>>()

  constructor(options: PopulationRasterEngineOptions = {}) {
    this.preferredStrategy = options.strategy ?? 'laea-direct'
  }

  private laeaApproved(variant: WorldPopVariant): boolean {
    const manifest = loadPopulationManifest()
    return manifest.conservation?.find((c) => c.variant === variant)?.laea_approved === true
  }

  resolveStrategy(variant: WorldPopVariant): PopulationRasterStrategy {
    if (this.preferredStrategy === 'wgs84-fallback') return 'wgs84-fallback'
    const laeaPath = processedLaeaCog(variant)
    if (existsSync(laeaPath) && this.laeaApproved(variant)) return 'laea-direct'
    return 'wgs84-fallback'
  }

  resolveRasterPath(variant: WorldPopVariant): {
    path: string
    strategy: PopulationRasterStrategy
    crs: 'LAEA-GT' | 'EPSG:4326'
  } {
    const strategy = this.resolveStrategy(variant)
    if (strategy === 'laea-direct') {
      return { path: processedLaeaCog(variant), strategy, crs: 'LAEA-GT' }
    }
    return { path: processedWgs84Cog(variant), strategy, crs: 'EPSG:4326' }
  }

  async ensureVariantReady(variant: WorldPopVariant): Promise<PopulationWarning[]> {
    const warnings: PopulationWarning[] = []
    const wgs84 = processedWgs84Cog(variant)
    if (!existsSync(wgs84)) {
      throw new Error(`COG WGS84 ${variant} no disponible. Ejecutar population:prepare-worldpop.`)
    }
    const resolved = this.resolveRasterPath(variant)
    if (resolved.strategy === 'wgs84-fallback') {
      warnings.push(
        populationWarning(
          'fallback_to_wgs84',
          `Análisis ${variant} usando COG WGS84 (LAEA no disponible o no aprobado).`,
        ),
      )
    }
    return warnings
  }

  async getMetadata(variant: WorldPopVariant) {
    const { path } = this.resolveRasterPath(variant)
    if (!this.metadataCache.has(path)) {
      this.metadataCache.set(path, await inspectPopulationRaster(path))
    }
    return this.metadataCache.get(path)!
  }

  async samplePoint(variant: WorldPopVariant, point: GeoPoint) {
    await this.ensureVariantReady(variant)
    const wgs84Path = processedWgs84Cog(variant)
    return samplePopulationCell(wgs84Path, point)
  }

  private async prepareCutline(
    geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
    geometryCrs: PopulationGeometryCrs | undefined,
    wsDir: string,
    basename: string,
  ): Promise<{ cutlinePath: string; cutlineSrs: string }> {
    if (geometryCrs === 'LAEA-GT') {
      const cutlinePath = `${wsDir}/${basename}_laea.geojson`
      writeFileSync(
        cutlinePath,
        `${JSON.stringify({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry, properties: {} }],
        })}\n`,
        'utf8',
      )
      return { cutlinePath, cutlineSrs: LAEA_PROJ4 }
    }
    const cutlinePath = await reprojectGeometryToLaea(geometry, wsDir)
    return { cutlinePath, cutlineSrs: LAEA_PROJ4 }
  }

  private async reprojectCutlineToWgs84(laeaPath: string, wgs84OutPath: string): Promise<void> {
    const res = await runCommand('ogr2ogr', [
      '-overwrite',
      '-t_srs',
      'EPSG:4326',
      wgs84OutPath,
      laeaPath,
    ])
    if (res.exitCode !== 0) {
      throw new Error(`Reproyección cutline a WGS84 falló: ${res.stderr || res.stdout}`)
    }
  }

  async sumAtGeometry(input: {
    variant: WorldPopVariant
    geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
    geometryCrs?: PopulationGeometryCrs
    workspaceDir: string
    clipBasename: string
  }): Promise<{ result: PopulationCutlineSumResult; warnings: PopulationWarning[] }> {
    const warnings = await this.ensureVariantReady(input.variant)
    const resolved = this.resolveRasterPath(input.variant)
    const { cutlinePath, cutlineSrs } = await this.prepareCutline(
      input.geometry,
      input.geometryCrs,
      input.workspaceDir,
      input.clipBasename,
    )

    let effectiveCutline = cutlinePath
    let effectiveSrs = cutlineSrs

    if (resolved.strategy === 'wgs84-fallback') {
      const wgsCutline = `${input.workspaceDir}/${input.clipBasename}_cutline_wgs84.geojson`
      await this.reprojectCutlineToWgs84(cutlinePath, wgsCutline)
      effectiveCutline = wgsCutline
      effectiveSrs = 'EPSG:4326'
    }

    const clipPath = `${input.workspaceDir}/${input.clipBasename}_clip.tif`
    const result = await sumPopulationAtCutline({
      sourceRasterPath: resolved.path,
      cutlinePath: effectiveCutline,
      cutlineSrs: effectiveSrs,
      clipOutputPath: clipPath,
    })
    return { result, warnings }
  }

  async analyzeGeometry(input: {
    variant: WorldPopVariant
    geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
    geometryCrs?: PopulationGeometryCrs
  }) {
    if (!isValidAnalysisGeometry(input.geometry)) {
      throw new Error('Geometría inválida para análisis raster')
    }
    return withRasterTempWorkspace(async (ws) => {
      return this.sumAtGeometry({
        variant: input.variant,
        geometry: input.geometry,
        geometryCrs: input.geometryCrs,
        workspaceDir: ws.dir,
        clipBasename: 'geometry',
      })
    })
  }

  async analyzeBuffers(input: AnalyzeBuffersInput & { variant: WorldPopVariant }) {
    if (input.points.length === 0) return []
    const radii = [...input.radiiMeters].sort((a, b) => a - b)
    return withRasterTempWorkspace(async (ws) => {
      const results: Array<{
        radiusM: number
        result: PopulationCutlineSumResult
        warnings: PopulationWarning[]
      }> = []

      for (const radiusM of radii) {
        const unionPath = ws.path(`buffer_${radiusM}m.geojson`)
        await buildMetricBufferUnionGeoJson({
          points: input.points,
          radiusM,
          pointsWgs84Path: ws.path(`points_${radiusM}_wgs84.geojson`),
          pointsLaeaPath: ws.path(`points_${radiusM}_laea.geojson`),
          unionPath,
          unify: true,
        })
        const fc = JSON.parse(readFileSync(unionPath, 'utf8')) as GeoJSON.FeatureCollection
        const geometry = fc.features[0]?.geometry
        if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) {
          throw new Error(`Buffer ${radiusM}m no produjo polígono válido`)
        }
        const { result, warnings } = await this.sumAtGeometry({
          variant: input.variant,
          geometry,
          geometryCrs: 'LAEA-GT',
          workspaceDir: ws.dir,
          clipBasename: `buffer_${radiusM}m`,
        })
        results.push({ radiusM, result, warnings })
      }
      return results
    })
  }

  getProductMeta(variant: WorldPopVariant) {
    return getWorldPopProduct(variant)
  }
}

export function createPopulationRasterEngine(
  options?: PopulationRasterEngineOptions,
): PopulationRasterEngine {
  return new PopulationRasterEngine(options)
}
