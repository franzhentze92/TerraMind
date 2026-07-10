import type {
  GeoPoint,
  LandCoverAnalysisInput,
  LandCoverAnalysisResult,
  LandCoverSourceStatus,
  ZoneAnalysisResult,
} from '@/modules/territory/land-cover/land-cover.types'

/**
 * Servicio genérico de cobertura del suelo.
 * Implementación completa en Commit 7A.2-B/C (tras aprobación de descarga).
 */
export interface LandCoverService {
  samplePoints(points: GeoPoint[]): Promise<LandCoverAnalysisResult['point_distribution']>
  analyzeGeometry(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): Promise<ZoneAnalysisResult>
  analyzeBuffers(input: LandCoverAnalysisInput): Promise<LandCoverAnalysisResult>
  getSourceStatus(): Promise<LandCoverSourceStatus>
}

export class LandCoverServiceNotReadyError extends Error {
  constructor(message = 'LandCoverService: raster no preparado. Ejecutar geo:prepare-land-cover.') {
    super(message)
    this.name = 'LandCoverServiceNotReadyError'
  }
}

/** Placeholder hasta Commit 7A.2-C. */
export function createLandCoverService(): LandCoverService {
  const notReady = () => {
    throw new LandCoverServiceNotReadyError()
  }
  return {
    samplePoints: notReady,
    analyzeGeometry: notReady,
    analyzeBuffers: notReady,
    getSourceStatus: async () => ({
      available: false,
      source_version: null,
      reference_year: null,
      source_cog_path: null,
      analytic_cog_path: null,
      cog_sha256: null,
      mapper_version: null,
      analysis_method_version: null,
    }),
  }
}
