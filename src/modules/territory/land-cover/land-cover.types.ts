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
  | 'point_nodata'
  | 'incomplete_zone_coverage'
  | 'mixed_point_classes'
  | 'centroid_fallback_used'
  | 'low_confidence_for_point_interpretation'
  | 'outdated_source_year'

export interface GeoPoint {
  lon: number
  lat: number
  id?: string
}

export interface ProviderClassSample {
  provider_code: string
  provider_name: string
  internal_class: InternalLandCoverClass
}

export interface ClassDistribution {
  /** Clase interna → porcentaje 0–100 (válidos, excluye nodata). */
  [internalClass: string]: number
}

export interface PointSampleResult {
  point: GeoPoint
  provider: ProviderClassSample | null
  is_nodata: boolean
}

export interface PointDistributionResult {
  samples: PointSampleResult[]
  /** Distribución por conteo de detecciones (no área). */
  class_distribution: ClassDistribution
  dominant_class: InternalLandCoverClass | null
  detections_sampled: number
}

export interface ZoneAnalysisResult {
  radius_m: number
  dominant_class: InternalLandCoverClass | null
  class_distribution: ClassDistribution
  valid_pixel_count: number
  nodata_pixel_count: number
  data_coverage_pct: number
  analyzed_area_ha: number
  /** Geometría unificada usada (WGS84 GeoJSON) — solo servidor, no API pública. */
  analysis_geometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon
}

export interface LandCoverAnalysisInput {
  points: GeoPoint[]
  zone_radii_m: number[]
  /**
   * Si true y hay puntos, une buffers con ST_UnaryUnion(ST_Collect(ST_Buffer(...))).
   * Evita doble conteo en zonas superpuestas.
   */
  unify_zone_buffers: boolean
}

export interface LandCoverAnalysisResult {
  point_distribution: PointDistributionResult
  zones: ZoneAnalysisResult[]
  warnings: LandCoverWarningCode[]
  status: LandCoverContextStatus
  source_version: string
  reference_year: number
  context_version: string
}

export interface LandCoverSourceStatus {
  available: boolean
  source_version: string | null
  reference_year: number | null
  source_cog_path: string | null
  analytic_cog_path: string | null
  cog_sha256: string | null
  mapper_version: string | null
  analysis_method_version: string | null
}
