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

export type PopulationOperationalHealth = 'healthy' | 'degraded' | 'unavailable'

export type PopulationWarningSeverity = 'info' | 'warning' | 'error'

export type PopulationWarningCode =
  | 'source_unavailable'
  | 'outdated_reference_year'
  | 'incomplete_coverage'
  | 'partial_coverage'
  | 'nodata_inside_geometry'
  | 'official_total_mismatch'
  | 'missing_admin_code'
  | 'settlement_source_unavailable'
  | 'adjustment_not_applied'
  | 'raster_processing_failed'
  | 'geometry_outside_coverage'
  | 'fallback_to_wgs84'
  | 'checksum_invalid'
  | 'constrained_unconstrained_large_difference'
  | 'resolution_limit'
  | 'geometry_too_small'
  | 'geometry_too_large'
  | 'invalid_geometry'
  | 'transform_failed'
  | 'raster_read_failed'

export type PopulationGeometryCrs = 'EPSG:4326' | 'LAEA-GT'

export type PopulationAdjustmentMethod =
  | 'none'
  | 'municipal_factor_ine'
  | 'department_factor_ine'

export type WorldPopServiceVariant = 'constrained' | 'unconstrained'

export interface GeoPoint {
  lon: number
  lat: number
  id?: string
}

export interface PopulationWarning {
  code: PopulationWarningCode
  severity: PopulationWarningSeverity
  message: string
  /** Solo uso interno — no serializar en DTO público. */
  technicalDetails?: string
}

export interface PopulationEstimate {
  estimatedPopulation: number
  estimateRounded: number
  analyzedAreaHa: number
  populationDensityPerKm2: number
  densityPerKm2: number
  dataCoveragePct: number
  source: string
  product: string
  variant: WorldPopServiceVariant
  sourceVersion: string
  referenceYear: number
  spatialResolutionM: number
  cellSemantics: 'persons_per_pixel'
  rasterHash?: string
  methodology: PopulationSemantics
  warnings: PopulationWarning[]
}

export interface PopulationPointSample extends PopulationEstimate {
  latitude: number
  longitude: number
  pointId?: string
  populationCellEstimate: number
  nodata: boolean
  outsideCoverage: boolean
}

export interface PopulationComparison {
  constrained: number
  unconstrained: number
  absoluteDifference: number
  percentageDifference: number
  interpretation: string
}

export interface PopulationBufferResult {
  radiusM: number
  estimatedPopulation: number
  estimateRounded: number
  validationEstimate?: number
  validationEstimateRounded?: number
  adjustedPopulation?: number
  analyzedAreaHa: number
  densityPerKm2: number
  dataCoveragePct: number
  adjustmentFactor?: number
  adjustmentMethod?: PopulationAdjustmentMethod
  warnings?: PopulationWarning[]
}

export interface PopulationGeometrySummary {
  type: GeoJSON.Geometry['type']
  geometryCrs: PopulationGeometryCrs
  pointCount?: number
  bufferRadiiM?: number[]
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
  status: 'available' | 'not_available' | 'partial'
  reason?: string
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
  operationalHealth: PopulationOperationalHealth
  isOfficial: boolean
  referenceYear: number
  sourceVersion: string
  spatialResolutionM: number
  semantics: PopulationSemantics
  rasterHash?: string
  validationRasterHash?: string
  storageReference?: string
  primaryVariant: WorldPopServiceVariant
  validationVariant: WorldPopServiceVariant
  operationalCrs?: string
  lastValidatedAt?: string
  warnings: PopulationWarning[]
  totalPopulation?: number
}

export interface SamplePointInput {
  latitude: number
  longitude: number
  pointId?: string
  variant?: WorldPopServiceVariant
}

export interface AnalyzeGeometryInput {
  geometry: GeoJSON.Geometry
  geometryCrs?: PopulationGeometryCrs
  includeValidation?: boolean
}

export interface AnalyzeBuffersInput {
  points: GeoPoint[]
  radiiMeters: number[]
  geometryCrs?: PopulationGeometryCrs
  includeValidation?: boolean
}

export interface CompareVariantsInput {
  geometry: GeoJSON.Geometry
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
  primary?: PopulationEstimate
  validation?: PopulationEstimate
  comparison?: PopulationComparison
  geometrySummary?: PopulationGeometrySummary
  generatedAt: string
  buffers: PopulationBufferResult[]
  administrativeContext?: AdministrativePopulationContext
  nearestSettlements: NearestSettlement[]
  warnings: PopulationWarning[]
  disclaimer: string
}

/** Alias explícito para resultados analíticos 7D.1B. */
export type PopulationAnalysisResult = PopulationAnalysis

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

export function roundPopulationEstimate(value: number): number {
  return Math.round(value)
}
