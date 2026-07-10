/**
 * Tipos genéricos de población territorial — TerraMind.
 * Reutilizable por incendios, inundaciones, áreas protegidas, cuencas, etc.
 */

export type PopulationSemantics =
  | 'official_administrative_population'
  | 'modelled_spatial_population'

export type PopulationContextStatus =
  | 'complete'
  | 'partial'
  | 'unavailable'
  | 'error'

export type PopulationWarningCode =
  | 'source_unavailable'
  | 'outdated_reference_year'
  | 'incomplete_coverage'
  | 'nodata_inside_geometry'
  | 'official_total_mismatch'
  | 'missing_admin_code'
  | 'settlement_source_unavailable'
  | 'adjustment_not_applied'
  | 'raster_processing_failed'
  | 'geometry_outside_coverage'

export type PopulationGeometryCrs = 'EPSG:4326' | 'LAEA-GT'

export type PopulationAdjustmentMethod =
  | 'none'
  | 'municipal_factor_ine'
  | 'department_factor_ine'

export interface GeoPoint {
  lon: number
  lat: number
  id?: string
}

export interface PopulationWarning {
  code: PopulationWarningCode
  message: string
}

export interface PopulationEstimate {
  estimatedPopulation: number
  analyzedAreaHa: number
  populationDensityPerKm2: number
  dataCoveragePct: number
  source: string
  sourceVersion: string
  referenceYear: number
  methodology: PopulationSemantics
  warnings: PopulationWarning[]
}

export interface PopulationBufferResult {
  radiusM: number
  estimatedPopulation: number
  adjustedPopulation?: number
  analyzedAreaHa: number
  densityPerKm2: number
  dataCoveragePct: number
  adjustmentFactor?: number
  adjustmentMethod?: PopulationAdjustmentMethod
}

export interface AdministrativeUnitPopulation {
  adminCode: string
  adminName: string
  adminLevel: 'department' | 'municipality'
  officialPopulation?: number
  urbanPopulation?: number
  ruralPopulation?: number
  households?: number
  projectionYear?: number
  source: string
  referenceYear: number
}

export interface AdministrativePopulationContext {
  department?: AdministrativeUnitPopulation
  municipality?: AdministrativeUnitPopulation
  officialPopulation?: number
  projectionYear?: number
  urbanPopulation?: number
  ruralPopulation?: number
  households?: number
  source: string
  referenceYear: number
  semantics: 'official_administrative_population'
}

export interface NearestSettlement {
  name: string
  settlementType?: string
  municipalityCode?: string
  municipalityName?: string
  departmentCode?: string
  departmentName?: string
  distanceM: number
  populationReported?: number
  source: string
  referenceYear?: number
}

export interface PopulationSourceStatus {
  sourceCode: string
  name: string
  isReady: boolean
  isOfficial: boolean
  referenceYear: number
  sourceVersion: string
  spatialResolutionM: number
  semantics: PopulationSemantics
  rasterHash?: string
  storageReference?: string
  warnings: PopulationWarning[]
}

export interface SamplePointInput {
  latitude: number
  longitude: number
  pointId?: string
}

export interface AnalyzeGeometryInput {
  geometry: GeoJSON.Geometry
  geometryCrs?: PopulationGeometryCrs
}

export interface AnalyzeBuffersInput {
  points: GeoPoint[]
  radiiMeters: number[]
  geometryCrs?: PopulationGeometryCrs
}

export interface GetAdministrativeContextInput {
  departmentCode?: string
  municipalityCode?: string
  referenceYear?: number
}

export interface GetNearestSettlementsInput {
  geometry: GeoJSON.Geometry
  limit?: number
}

export interface PopulationAnalysis {
  contextVersion: string
  status: PopulationContextStatus
  semantics: PopulationSemantics
  source: string
  sourceVersion: string
  referenceYear: number
  rasterHash?: string
  estimate?: PopulationEstimate
  buffers: PopulationBufferResult[]
  administrativeContext?: AdministrativePopulationContext
  nearestSettlements: NearestSettlement[]
  warnings: PopulationWarning[]
  disclaimer: string
}

export interface PopulationDataQuality {
  source: string
  referenceYear: number
  officialOrModelled: PopulationSemantics
  spatialResolutionM: number
  populationType: 'resident' | 'present' | 'official_census'
  dataCoveragePct: number
  administrativeReconciliationStatus:
    | 'not_applicable'
    | 'pending'
    | 'validated'
    | 'mismatch'
  adjustmentApplied: boolean
  warnings: PopulationWarningCode[]
}
