/**
 * Tipos genéricos de cobertura del suelo — TerraMind Territory module.
 * Reutilizable por incendios, municipios, áreas protegidas, etc.
 */

/** Taxonomía interna estable (independiente del proveedor). */
export type InternalLandCoverClass =
  | 'forest'
  | 'shrubland'
  | 'grassland'
  | 'cropland'
  | 'built_up'
  | 'bare_sparse'
  | 'snow_ice'
  | 'permanent_water'
  | 'herbaceous_wetland'
  | 'mangrove'
  | 'moss_lichen'
  | 'unknown'

export type LandCoverContextStatus = 'complete' | 'partial' | 'unavailable' | 'error'

export type LandCoverWarningCode =
  | 'source_unavailable'
  | 'raster_hash_mismatch'
  | 'point_nodata'
  | 'point_outside_coverage'
  | 'incomplete_zone_coverage'
  | 'mixed_point_classes'
  | 'outdated_source_year'
  | 'invalid_geometry'
  | 'raster_processing_failed'

export type LandCoverGeometryCrs = 'EPSG:4326' | 'LAEA-GT'

export interface GeoPoint {
  lon: number
  lat: number
  id?: string
}

export interface LandCoverPointSample {
  latitude: number
  longitude: number
  pointId?: string
  providerClassCode: number | null
  providerClassName: string | null
  internalClass: InternalLandCoverClass
  nodata: boolean
  outsideCoverage: boolean
}

export interface ClassDistributionEntry {
  internalClass: InternalLandCoverClass
  providerClassCode: number
  count: number
  pct: number
}

export interface LandCoverDistribution {
  dominantClass: InternalLandCoverClass | null
  classDistribution: ClassDistributionEntry[]
  validPixelCount: number
  nodataPixelCount: number
  dataCoveragePct: number
  analyzedAreaHa: number
}

export interface LandCoverBufferResult {
  radiusM: number
  geometryMethod: 'unified_buffer_union' | 'single_buffer' | 'provided_geometry'
  distribution: LandCoverDistribution
}

export interface LandCoverAnalysis {
  source: string
  sourceVersion: string
  sourceYear: number
  rasterHash: string
  mapperVersion: string
  analysisMethodVersion: string
  contextVersion: string
  pointDistribution: LandCoverDistribution
  pointSamples: LandCoverPointSample[]
  zones: LandCoverBufferResult[]
  warnings: LandCoverWarningCode[]
  status: LandCoverContextStatus
  generatedAt: string
}

export interface LandCoverSourceStatus {
  available: boolean
  source: string | null
  sourceVersion: string | null
  sourceYear: number | null
  sourceCogPath: string | null
  analyticCogPath: string | null
  sourceCogSha256: string | null
  analyticCogSha256: string | null
  mapperVersion: string | null
  analysisMethodVersion: string | null
  areaStrategy: string | null
  gdalVersion: string | null
}

export interface SamplePointsInput {
  points: GeoPoint[]
}

export interface AnalyzeGeometryInput {
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
  geometryCrs: LandCoverGeometryCrs
}

export interface AnalyzeBuffersInput {
  points: GeoPoint[]
  radiiMeters: number[]
  unifyBuffers?: boolean
}

/** @deprecated Usar LandCoverPointSample */
export interface ProviderClassSample {
  provider_code: string
  provider_name: string
  internal_class: InternalLandCoverClass
}

/** @deprecated Usar ClassDistributionEntry */
export interface ClassDistribution {
  [internalClass: string]: number
}

/** @deprecated Usar LandCoverPointSample */
export interface PointSampleResult {
  point: GeoPoint
  provider: ProviderClassSample | null
  is_nodata: boolean
}

/** @deprecated Usar LandCoverDistribution */
export interface PointDistributionResult {
  samples: PointSampleResult[]
  class_distribution: ClassDistribution
  dominant_class: InternalLandCoverClass | null
  detections_sampled: number
}

/** @deprecated Usar LandCoverBufferResult */
export interface ZoneAnalysisResult {
  radius_m: number
  dominant_class: InternalLandCoverClass | null
  class_distribution: ClassDistribution
  valid_pixel_count: number
  nodata_pixel_count: number
  data_coverage_pct: number
  analyzed_area_ha: number
  analysis_geometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon
}

/** @deprecated Usar AnalyzeBuffersInput */
export interface LandCoverAnalysisInput {
  points: GeoPoint[]
  zone_radii_m: number[]
  unify_zone_buffers: boolean
}

/** @deprecated Usar LandCoverAnalysis */
export interface LandCoverAnalysisResult {
  point_distribution: PointDistributionResult
  zones: ZoneAnalysisResult[]
  warnings: LandCoverWarningCode[]
  status: LandCoverContextStatus
  source_version: string
  reference_year: number
  context_version: string
}
