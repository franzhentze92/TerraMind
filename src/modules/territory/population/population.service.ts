import {
  buildPopulationContextVersion,
  POPULATION_DEFAULT_BUFFER_RADII_M,
} from '@/modules/territory/population/population-context-version'
import { POPULATION_SPATIAL_DISCLAIMER } from '@/modules/territory/population/population-disclaimer'
import {
  getOfficialAdministrativeSource,
  getPrimarySpatialSource,
  POPULATION_SOURCE_REGISTRY,
} from '@/modules/territory/population/population-source-registry'
import type {
  AdministrativePopulationContext,
  AnalyzeBuffersInput,
  AnalyzeGeometryInput,
  GetAdministrativeContextInput,
  GetNearestSettlementsInput,
  NearestSettlement,
  PopulationAnalysis,
  PopulationBufferResult,
  PopulationContextStatus,
  PopulationEstimate,
  PopulationSourceStatus,
  PopulationWarning,
  SamplePointInput,
} from '@/modules/territory/population/population.types'
import { populationWarning } from '@/modules/territory/population/population-warnings'
import {
  getLocalPopulationSourceStatus,
} from '@/modules/territory/population/processing/source-status'
import { WORLDPOP_ANALYSIS_METHOD_VERSION } from '@/modules/territory/population/providers/worldpop/worldpop.manifest'

export interface PopulationService {
  getSourceStatus(): Promise<PopulationSourceStatus>
  samplePoint(input: SamplePointInput): Promise<PopulationEstimate>
  analyzeGeometry(input: AnalyzeGeometryInput): Promise<PopulationEstimate>
  analyzeBuffers(input: AnalyzeBuffersInput): Promise<PopulationAnalysis>
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

function unavailableStatus(warnings: PopulationWarning[]): PopulationSourceStatus {
  const spatial = getPrimarySpatialSource()
  return {
    sourceCode: spatial.sourceCode,
    name: spatial.name,
    isReady: false,
    isOfficial: false,
    referenceYear: spatial.referenceYear,
    sourceVersion: spatial.sourceVersion,
    spatialResolutionM: spatial.spatialResolutionM ?? 100,
    semantics: 'modelled_spatial_population',
    warnings,
  }
}

function resolveStatus(warnings: PopulationWarning[]): PopulationContextStatus {
  if (warnings.some((w) => w.code === 'source_unavailable')) return 'unavailable'
  if (warnings.some((w) => w.code === 'raster_processing_failed')) return 'error'
  if (
    warnings.some(
      (w) =>
        w.code === 'incomplete_coverage' ||
        w.code === 'nodata_inside_geometry' ||
        w.code === 'geometry_outside_coverage',
    )
  ) {
    return 'partial'
  }
  return 'complete'
}

/**
 * Stub de diseño 7D.1 — sin raster montado ni persistencia.
 * Implementación operativa en 7D.1B.
 */
export function createPopulationService(): PopulationService {
  const notReadyWarnings = [
    populationWarning(
      'source_unavailable',
      'Raster poblacional no descargado ni validado (fase 7D.1A pendiente).',
    ),
    populationWarning(
      'adjustment_not_applied',
      'Reconciliación municipal INE no aplicada en esta fase.',
    ),
  ]

  return {
    async getSourceStatus() {
      return getLocalPopulationSourceStatus()
    },

    async samplePoint() {
      throw new PopulationServiceNotReadyError()
    },

    async analyzeGeometry() {
      throw new PopulationServiceNotReadyError()
    },

    async analyzeBuffers(input) {
      const spatial = getPrimarySpatialSource()
      const radii = input.radiiMeters.length
        ? input.radiiMeters
        : [...POPULATION_DEFAULT_BUFFER_RADII_M]
      const warnings: PopulationWarning[] = [
        ...notReadyWarnings,
        populationWarning(
          'settlement_source_unavailable',
          'Capa de asentamientos no cargada (fase 7D.2+).',
        ),
      ]
      const buffers: PopulationBufferResult[] = radii.map((radiusM) => ({
        radiusM,
        estimatedPopulation: 0,
        analyzedAreaHa: 0,
        densityPerKm2: 0,
        dataCoveragePct: 0,
      }))
      return {
        contextVersion: buildPopulationContextVersion({
          sourceCode: spatial.sourceCode,
          sourceVersion: spatial.sourceVersion,
          productType: 'constrained',
          rasterHash: 'pending',
          referenceYear: spatial.referenceYear,
          analysisMethodVersion: WORLDPOP_ANALYSIS_METHOD_VERSION,
          crs: 'LAEA-GT',
          resamplingMethod: 'sum',
          zoneRadiiM: radii,
        }),
        status: resolveStatus(warnings),
        semantics: 'modelled_spatial_population',
        source: spatial.sourceCode,
        sourceVersion: spatial.sourceVersion,
        referenceYear: spatial.referenceYear,
        buffers,
        nearestSettlements: [],
        warnings,
        disclaimer: POPULATION_SPATIAL_DISCLAIMER,
      }
    },

    async getAdministrativeContext(input) {
      const official = getOfficialAdministrativeSource()
      if (!input.departmentCode && !input.municipalityCode) {
        throw new PopulationServiceNotReadyError(
          'Se requiere departmentCode o municipalityCode.',
        )
      }
      return {
        source: official.sourceCode,
        referenceYear: official.referenceYear,
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
