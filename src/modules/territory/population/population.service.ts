import {
  buildPopulationContextVersion,
  POPULATION_DEFAULT_BUFFER_RADII_M,
  POPULATION_FALLBACK_POLICY,
  POPULATION_PRIMARY_VARIANT,
  POPULATION_VALIDATION_VARIANT,
} from '@/modules/territory/population/population-context-version'
import { POPULATION_SPATIAL_DISCLAIMER } from '@/modules/territory/population/population-disclaimer'
import {
  getPrimarySpatialSource,
  POPULATION_SOURCE_REGISTRY,
} from '@/modules/territory/population/population-source-registry'
import type {
  AdministrativePopulationContext,
  AnalyzeBuffersInput,
  AnalyzeGeometryInput,
  CompareVariantsInput,
  GetAdministrativeContextInput,
  GetNearestSettlementsInput,
  NearestSettlement,
  PopulationAnalysis,
  PopulationBufferResult,
  PopulationComparison,
  PopulationContextStatus,
  PopulationEstimate,
  PopulationGeometrySummary,
  PopulationPointSample,
  PopulationSourceStatus,
  PopulationWarning,
  SamplePointInput,
  WorldPopServiceVariant,
} from '@/modules/territory/population/population.types'
import { roundPopulationEstimate } from '@/modules/territory/population/population.types'
import {
  collectPopulationZoneWarnings,
  dedupeWarnings,
  populationWarning,
} from '@/modules/territory/population/population-warnings'
import {
  getLocalPopulationSourceStatus,
  type LocalPopulationSourceStatus,
} from '@/modules/territory/population/processing/source-status'
import type { PopulationCutlineSumResult } from '@/modules/territory/population/processing/raster-cutline-sum'
import {
  createPopulationRasterEngine,
  type PopulationRasterEngine,
} from '@/modules/territory/population/raster/population-raster-engine'
import { buildPopulationComparison } from '@/modules/territory/population/raster/population-variant-compare'
import { isValidAnalysisGeometry } from '@/modules/territory/land-cover/raster/raster-geometry'
import { WORLDPOP_ANALYSIS_METHOD_VERSION } from '@/modules/territory/population/providers/worldpop/worldpop.manifest'

export interface PopulationService {
  getSourceStatus(): Promise<PopulationSourceStatus>
  samplePoint(input: SamplePointInput): Promise<PopulationPointSample>
  analyzeGeometry(input: AnalyzeGeometryInput): Promise<PopulationAnalysis>
  analyzeBuffers(input: AnalyzeBuffersInput): Promise<PopulationAnalysis>
  compareVariants(input: CompareVariantsInput): Promise<PopulationComparison>
  getAdministrativeContext(
    input: GetAdministrativeContextInput,
  ): Promise<AdministrativePopulationContext>
  getNearestSettlements(input: GetNearestSettlementsInput): Promise<NearestSettlement[]>
}

export class PopulationServiceNotReadyError extends Error {
  constructor(message = 'PopulationService: raster o datos administrativos no preparados.') {
    super(message)
    this.name = 'PopulationServiceNotReadyError'
  }
}

export class PopulationServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PopulationServiceError'
  }
}

export interface PopulationServiceOptions {
  rasterEngine?: PopulationRasterEngine
}

const MAX_BUFFER_RADIUS_M = 50_000
const MAX_POINTS = 50

function resolveStatus(warnings: PopulationWarning[]): PopulationContextStatus {
  if (warnings.some((w) => w.code === 'source_unavailable' || w.code === 'checksum_invalid')) {
    return 'unavailable'
  }
  if (
    warnings.some(
      (w) =>
        w.code === 'raster_processing_failed' ||
        w.code === 'invalid_geometry' ||
        w.code === 'transform_failed' ||
        w.code === 'raster_read_failed',
    )
  ) {
    return 'error'
  }
  if (
    warnings.some(
      (w) =>
        w.code === 'incomplete_coverage' ||
        w.code === 'partial_coverage' ||
        w.code === 'nodata_inside_geometry' ||
        w.code === 'geometry_outside_coverage' ||
        w.code === 'fallback_to_wgs84',
    )
  ) {
    return 'partial'
  }
  return 'complete'
}

function validateCoordinates(lat: number, lon: number): void {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new PopulationServiceError('Coordenadas inválidas.')
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new PopulationServiceError('Coordenadas fuera de rango WGS84.')
  }
}

function validateRadii(radiiMeters: number[]): number[] {
  const radii = radiiMeters.length ? [...radiiMeters] : [...POPULATION_DEFAULT_BUFFER_RADII_M]
  for (const r of radii) {
    if (!Number.isFinite(r) || r <= 0) {
      throw new PopulationServiceError('Radios deben ser números positivos.')
    }
    if (r > MAX_BUFFER_RADIUS_M) {
      throw new PopulationServiceError(`Radio ${r}m excede el máximo (${MAX_BUFFER_RADIUS_M}m).`)
    }
  }
  return [...new Set(radii)].sort((a, b) => a - b)
}

function assertAnalyzableGeometry(
  geometry: GeoJSON.Geometry,
): asserts geometry is GeoJSON.Polygon | GeoJSON.MultiPolygon {
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
    throw new PopulationServiceError('Solo Polygon y MultiPolygon son soportados.')
  }
  if (!isValidAnalysisGeometry(geometry)) {
    throw new PopulationServiceError('Geometría inválida para análisis.')
  }
}

function toPublicSourceStatus(local: LocalPopulationSourceStatus): PopulationSourceStatus {
  let operationalHealth: PopulationSourceStatus['operationalHealth'] = 'unavailable'
  if (local.isReady) {
    const laeaOk = local.variants.every((v) => v.laeaApproved || v.wgs84CogAvailable)
    operationalHealth = laeaOk && local.checksumValid ? 'healthy' : 'degraded'
  } else if (local.variants.some((v) => v.wgs84CogAvailable)) {
    operationalHealth = 'degraded'
  }

  const constrained = local.variants.find((v) => v.variant === 'constrained')
  const unconstrained = local.variants.find((v) => v.variant === 'unconstrained')

  return {
    sourceCode: local.sourceCode,
    name: local.name,
    isReady: local.isReady,
    operationalHealth,
    isOfficial: local.isOfficial,
    referenceYear: local.referenceYear,
    sourceVersion: local.sourceVersion,
    spatialResolutionM: local.spatialResolutionM,
    semantics: local.semantics,
    rasterHash: constrained?.checksumValid ? local.rasterHash : undefined,
    validationRasterHash: local.validationRasterHash,
    storageReference: 'worldpop/processed',
    primaryVariant: POPULATION_PRIMARY_VARIANT,
    validationVariant: POPULATION_VALIDATION_VARIANT,
    operationalCrs: constrained?.laeaApproved ? 'LAEA-GT' : 'EPSG:4326',
    lastValidatedAt: local.generatedAt,
    warnings: local.warnings,
    totalPopulation: local.totalPopulation,
  }
}

function buildEstimate(
  variant: WorldPopServiceVariant,
  sum: PopulationCutlineSumResult,
  warnings: PopulationWarning[],
  rasterHash?: string,
): PopulationEstimate {
  const product = variant === 'constrained' ? 'worldpop_constrained_2020' : 'worldpop_unconstrained_2020'
  const spatial = getPrimarySpatialSource()
  const estimatedPopulation = sum.populationSum
  return {
    estimatedPopulation,
    estimateRounded: roundPopulationEstimate(estimatedPopulation),
    analyzedAreaHa: sum.analyzedAreaHa,
    populationDensityPerKm2: sum.densityPerKm2,
    densityPerKm2: sum.densityPerKm2,
    dataCoveragePct: sum.dataCoveragePct,
    source: spatial.sourceCode,
    product,
    variant,
    sourceVersion: spatial.sourceVersion,
    referenceYear: spatial.referenceYear,
    spatialResolutionM: spatial.spatialResolutionM ?? 100,
    cellSemantics: 'persons_per_pixel',
    rasterHash,
    methodology: 'modelled_spatial_population',
    warnings,
  }
}

export function createPopulationService(
  options: PopulationServiceOptions = {},
): PopulationService {
  const raster = options.rasterEngine ?? createPopulationRasterEngine()
  let cachedStatus: LocalPopulationSourceStatus | null = null
  let cachedStatusAt = 0
  const STATUS_TTL_MS = 30_000

  async function ensureOperational(): Promise<LocalPopulationSourceStatus> {
    const now = Date.now()
    if (!cachedStatus || now - cachedStatusAt > STATUS_TTL_MS) {
      cachedStatus = await getLocalPopulationSourceStatus()
      cachedStatusAt = now
    }
    if (!cachedStatus.isReady) {
      throw new PopulationServiceNotReadyError(
        'Raster poblacional no listo. Ejecutar population:download-worldpop y population:prepare-worldpop.',
      )
    }
    return cachedStatus
  }

  async function buildContextVersion(radii: number[], operationalCrs: string, hash: string) {
    const spatial = getPrimarySpatialSource()
    return buildPopulationContextVersion({
      sourceCode: spatial.sourceCode,
      sourceVersion: spatial.sourceVersion,
      productType: 'dual_use',
      rasterHash: hash,
      referenceYear: spatial.referenceYear,
      analysisMethodVersion: WORLDPOP_ANALYSIS_METHOD_VERSION,
      crs: operationalCrs,
      resamplingMethod: 'sum',
      zoneRadiiM: radii,
      fallbackPolicy: POPULATION_FALLBACK_POLICY,
      primaryVariant: POPULATION_PRIMARY_VARIANT,
      validationVariant: POPULATION_VALIDATION_VARIANT,
      adjustmentMethod: 'none',
    })
  }

  return {
    async getSourceStatus() {
      const local = await getLocalPopulationSourceStatus()
      return toPublicSourceStatus(local)
    },

    async samplePoint(input) {
      validateCoordinates(input.latitude, input.longitude)
      const status = await ensureOperational()
      const variant = input.variant ?? POPULATION_PRIMARY_VARIANT
      const warnings: PopulationWarning[] = [
        populationWarning(
          'resolution_limit',
          'Valor de celda a ~100 m; no representa población exacta en el punto.',
        ),
        populationWarning('adjustment_not_applied', 'Sin reconciliación administrativa INE.'),
      ]

      try {
        const sample = await raster.samplePoint(variant, {
          lat: input.latitude,
          lon: input.longitude,
          id: input.pointId,
        })
        if (sample.outsideCoverage) {
          warnings.push(
            populationWarning('geometry_outside_coverage', 'Punto fuera de cobertura raster.'),
          )
        }
        if (sample.nodata) {
          warnings.push(populationWarning('nodata_inside_geometry', 'Celda sin dato poblacional.'))
        }

        const product =
          variant === 'constrained' ? 'worldpop_constrained_2020' : 'worldpop_unconstrained_2020'
        const spatial = getPrimarySpatialSource()
        return {
          latitude: sample.latitude,
          longitude: sample.longitude,
          pointId: sample.pointId,
          populationCellEstimate: sample.populationCellEstimate,
          estimatedPopulation: sample.populationCellEstimate,
          estimateRounded: sample.estimateRounded,
          analyzedAreaHa: 0.01,
          populationDensityPerKm2: sample.populationCellEstimate * 100,
          densityPerKm2: sample.populationCellEstimate * 100,
          dataCoveragePct: sample.nodata ? 0 : 100,
          source: spatial.sourceCode,
          product,
          variant,
          sourceVersion: spatial.sourceVersion,
          referenceYear: spatial.referenceYear,
          spatialResolutionM: 100,
          cellSemantics: 'persons_per_pixel',
          rasterHash: status.rasterHash,
          methodology: 'modelled_spatial_population',
          nodata: sample.nodata,
          outsideCoverage: sample.outsideCoverage,
          warnings: dedupeWarnings(warnings),
        }
      } catch (error) {
        throw new PopulationServiceError(
          error instanceof Error ? error.message : 'Error muestreando punto',
        )
      }
    },

    async analyzeGeometry(input) {
      assertAnalyzableGeometry(input.geometry)
      const status = await ensureOperational()
      const geometryCrs = input.geometryCrs ?? 'EPSG:4326'
      const warnings: PopulationWarning[] = [
        populationWarning('adjustment_not_applied', 'Sin reconciliación administrativa INE.'),
      ]

      const { result, warnings: engineWarnings } = await raster.analyzeGeometry({
        variant: POPULATION_PRIMARY_VARIANT,
        geometry: input.geometry,
        geometryCrs,
      })
      warnings.push(...engineWarnings)
      warnings.push(
        ...collectPopulationZoneWarnings({
          dataCoveragePct: result.dataCoveragePct,
          nodataPixelCount: result.nodataPixelCount,
          referenceYear: status.referenceYear,
        }),
      )

      let validation: PopulationEstimate | undefined
      let comparison: PopulationComparison | undefined
      if (input.includeValidation) {
        const validationRun = await raster.analyzeGeometry({
          variant: POPULATION_VALIDATION_VARIANT,
          geometry: input.geometry,
          geometryCrs,
        })
        validation = buildEstimate(
          POPULATION_VALIDATION_VARIANT,
          validationRun.result,
          validationRun.warnings,
          status.rasterHash,
        )
        comparison = buildPopulationComparison(
          result.populationSum,
          validationRun.result.populationSum,
        )
        if (comparison.percentageDifference > 20) {
          warnings.push(
            populationWarning(
              'constrained_unconstrained_large_difference',
              `Diferencia constrained/unconstrained: ${comparison.percentageDifference}%.`,
            ),
          )
        }
      }

      const primary = buildEstimate(
        POPULATION_PRIMARY_VARIANT,
        result,
        warnings,
        status.rasterHash,
      )
      const operationalCrs = raster.resolveRasterPath(POPULATION_PRIMARY_VARIANT).crs
      const allWarnings = dedupeWarnings(warnings)

      return {
        contextVersion: await buildContextVersion([], operationalCrs, status.rasterHash ?? 'unknown'),
        status: resolveStatus(allWarnings),
        semantics: 'modelled_spatial_population',
        source: primary.source,
        sourceVersion: primary.sourceVersion,
        referenceYear: primary.referenceYear,
        rasterHash: status.rasterHash,
        primary,
        validation,
        comparison,
        estimate: primary,
        geometrySummary: {
          type: input.geometry.type,
          geometryCrs,
        },
        generatedAt: new Date().toISOString(),
        buffers: [],
        nearestSettlements: [],
        warnings: allWarnings,
        disclaimer: POPULATION_SPATIAL_DISCLAIMER,
      }
    },

    async analyzeBuffers(input) {
      if (!input.points.length) {
        throw new PopulationServiceError('Se requiere al menos un punto.')
      }
      if (input.points.length > MAX_POINTS) {
        throw new PopulationServiceError(`Máximo ${MAX_POINTS} puntos por análisis.`)
      }
      for (const p of input.points) validateCoordinates(p.lat, p.lon)

      const status = await ensureOperational()
      const radii = validateRadii(input.radiiMeters)
      const warnings: PopulationWarning[] = [
        populationWarning('adjustment_not_applied', 'Sin reconciliación administrativa INE.'),
      ]

      const primaryRuns = await raster.analyzeBuffers({
        points: input.points,
        radiiMeters: radii,
        geometryCrs: input.geometryCrs,
        variant: POPULATION_PRIMARY_VARIANT,
      })

      let validationRuns: Awaited<ReturnType<PopulationRasterEngine['analyzeBuffers']>> | undefined
      if (input.includeValidation) {
        validationRuns = await raster.analyzeBuffers({
          points: input.points,
          radiiMeters: radii,
          geometryCrs: input.geometryCrs,
          variant: POPULATION_VALIDATION_VARIANT,
        })
      }

      const buffers: PopulationBufferResult[] = primaryRuns.map((run, idx) => {
        const zoneWarnings = collectPopulationZoneWarnings({
          dataCoveragePct: run.result.dataCoveragePct,
          nodataPixelCount: run.result.nodataPixelCount,
          referenceYear: status.referenceYear,
        })
        const bufferWarnings = dedupeWarnings([...warnings, ...run.warnings, ...zoneWarnings])
        const validationEstimate = validationRuns?.[idx]?.result.populationSum
        return {
          radiusM: run.radiusM,
          estimatedPopulation: run.result.populationSum,
          estimateRounded: roundPopulationEstimate(run.result.populationSum),
          validationEstimate,
          validationEstimateRounded:
            validationEstimate != null ? roundPopulationEstimate(validationEstimate) : undefined,
          analyzedAreaHa: run.result.analyzedAreaHa,
          densityPerKm2: run.result.densityPerKm2,
          dataCoveragePct: run.result.dataCoveragePct,
          warnings: bufferWarnings,
        }
      })

      const allWarnings = dedupeWarnings([
        ...warnings,
        ...buffers.flatMap((b) => b.warnings ?? []),
      ])
      const operationalCrs = raster.resolveRasterPath(POPULATION_PRIMARY_VARIANT).crs

      return {
        contextVersion: await buildContextVersion(radii, operationalCrs, status.rasterHash ?? 'unknown'),
        status: resolveStatus(allWarnings),
        semantics: 'modelled_spatial_population',
        source: getPrimarySpatialSource().sourceCode,
        sourceVersion: getPrimarySpatialSource().sourceVersion,
        referenceYear: status.referenceYear,
        rasterHash: status.rasterHash,
        generatedAt: new Date().toISOString(),
        geometrySummary: {
          type: 'Point',
          geometryCrs: input.geometryCrs ?? 'EPSG:4326',
          pointCount: input.points.length,
          bufferRadiiM: radii,
        },
        buffers,
        nearestSettlements: [],
        warnings: allWarnings,
        disclaimer: POPULATION_SPATIAL_DISCLAIMER,
      }
    },

    async compareVariants(input) {
      assertAnalyzableGeometry(input.geometry)
      await ensureOperational()
      const geometryCrs = input.geometryCrs ?? 'EPSG:4326'
      const [constrained, unconstrained] = await Promise.all([
        raster.analyzeGeometry({
          variant: 'constrained',
          geometry: input.geometry,
          geometryCrs,
        }),
        raster.analyzeGeometry({
          variant: 'unconstrained',
          geometry: input.geometry,
          geometryCrs,
        }),
      ])
      return buildPopulationComparison(
        constrained.result.populationSum,
        unconstrained.result.populationSum,
      )
    },

    async getAdministrativeContext(input) {
      if (!input.departmentCode && !input.municipalityCode) {
        throw new PopulationServiceError('Se requiere departmentCode o municipalityCode.')
      }
      return {
        status: 'not_available',
        reason: 'INE administrative data not imported',
        source: 'ine_guatemala',
        referenceYear: input.referenceYear ?? 2020,
        semantics: 'official_administrative_population',
      }
    },

    async getNearestSettlements() {
      throw new PopulationServiceNotReadyError(
        'Asentamientos: fuente INE lugares poblados pendiente de carga (7D.2).',
      )
    },
  }
}

export function listRegisteredPopulationSources() {
  return POPULATION_SOURCE_REGISTRY
}
