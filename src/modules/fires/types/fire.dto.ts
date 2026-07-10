export type FireEventStatus = 'new' | 'active' | 'monitoring' | 'closed'
export type FireValidationStatus = 'no_validado' | 'probable' | 'confirmado'
export type FireRiskLevel = 'informativo' | 'observacion' | 'atencion' | 'alto' | 'critico'
export type FireGeometryMethod = 'single_detection_buffer' | 'convex_hull_buffer'

export interface FireDataStatusDto {
  last_firms_ingestion_at: string | null
  last_successful_ingestion_at: string | null
  latest_satellite_acquisition_at: string | null
  observations_downloaded: number
  sources_expected: number
  sources_queried_successfully: number
  sources_with_detections: number
  sources_failed: number
  failed_source_names: string[]
  ingestion_status: string
  is_partial: boolean
  is_stale: boolean
  stale_after_minutes: number
}

export interface FirePipelineHealthDto {
  enabled: boolean
  interval_minutes: number
  is_running: boolean
  scheduler_active: boolean
  last_run: {
    status: string
    started_at: string
    completed_at: string | null
    duration_ms: number | null
    trigger_type: string
  } | null
  last_success_at: string | null
  consecutive_failures: number
  next_run_at: string | null
  last_stage_metrics?: Record<
    string,
    { status: string; duration_ms: number; metrics?: Record<string, unknown> }
  >
  failed_runs_last_24h: number
  partial_runs_last_24h: number
  is_healthy: boolean
  is_stale: boolean
  alert_level: 'ok' | 'warning' | 'critical'
  generated_at: string
}

export interface FireSummaryDto {
  window_hours: number
  window_start_utc: string
  window_end_utc: string
  observations_downloaded: number
  detections_count: number
  detections_outside_count: number
  events_count: number
  active_events_count: number
  monitoring_events_count: number
  attention_events_count: number
  probable_events_count: number
  multisatellite_events_count: number
  confirmed_events_count: number
  departments_affected_count: number
  highest_priority_event: FireHighestPriorityEventDto | null
  data_status: FireDataStatusDto
  generated_at: string
}

export interface FireHighestPriorityEventDto {
  id: string
  department: string | null
  risk_level: FireRiskLevel
  priority_score: number
  detection_count: number
  satellite_count: number
  last_detected_at: string
}

export interface FireEventDetectionDto {
  id: string
  latitude: number
  longitude: number
  acquired_at_utc: string
  source_product: string
  satellite: string | null
  instrument: string | null
  confidence_normalized: 'baja' | 'media' | 'alta' | null
  frp_mw: number | null
  brightness: number | null
  daynight: string | null
}

export interface FireEventDetailDto extends FireEventListItemDto {
  estimated_area_ha: number | null
  area_disclaimer: string
  detections: FireEventDetectionDto[]
  evidence_summary: string
  interpretation: string
  protected_area_context: ProtectedAreaContextDto | null
  land_cover_context: LandCoverContextDto | null
  land_cover_enrichment: LandCoverEnrichmentStateDto | null
  population_context: PopulationContextDto | null
  population_enrichment: PopulationEnrichmentStateDto | null
  generated_at: string
}

export type ProtectedAreaContextStatus = 'complete' | 'partial' | 'unavailable' | 'error'

export interface ProtectedAreaIntersectDto {
  display_name: string
  general_name: string | null
  specific_name: string | null
  feature_type: string | null
}

export interface ProtectedAreaNearestDto {
  display_name: string
  general_name: string | null
  specific_name: string | null
  distance_m: number | null
  proximity_label: 'dentro' | 'muy_cerca' | 'cerca' | 'entorno_proximo' | 'distante'
}

export interface ProtectedAreaContextDto {
  status: ProtectedAreaContextStatus
  inside_protected_area: boolean | null
  detections_inside_count: number
  intersecting_areas: ProtectedAreaIntersectDto[]
  nearest_area: ProtectedAreaNearestDto | null
  diagnostic_geometry_intersects_protected_area: boolean | null
  source_name: string
  source_version: string
  generated_at: string | null
}

export type LandCoverContextStatus = 'complete' | 'partial' | 'unavailable' | 'error'

export interface LandCoverSourceDto {
  name: string
  version: string
  year: number
  resolution_m: number
}

export interface LandCoverClassCountDto {
  class: string
  label: string
  count: number
  percentage: number
}

export interface LandCoverClassAreaDto {
  class: string
  label: string
  percentage: number
  area_ha: number | null
}

export interface LandCoverPointEvidenceDto {
  detections_sampled: number
  dominant_class: string | null
  mixed: boolean
  class_distribution: LandCoverClassCountDto[]
}

export interface LandCoverZoneDto {
  radius_m: number
  dominant_class: string | null
  dominant_label: string | null
  class_distribution: LandCoverClassAreaDto[]
  valid_pixel_count: number
  data_coverage_pct: number | null
  analyzed_area_ha: number | null
}

export interface LandCoverContextDto {
  status: LandCoverContextStatus
  source: LandCoverSourceDto
  generated_at: string
  context_version: string
  point_evidence: LandCoverPointEvidenceDto
  zones: LandCoverZoneDto[]
  warnings: string[]
  disclaimer: string
}

export type LandCoverEnrichmentQueueStatus =
  | 'queued'
  | 'processing'
  | 'complete'
  | 'failed'
  | 'unavailable'

export interface LandCoverEnrichmentStateDto {
  status: LandCoverEnrichmentQueueStatus
  message: string | null
}

export type PopulationContextStatus =
  | 'complete'
  | 'partial'
  | 'unavailable'
  | 'error'
  | 'stale'

export interface PopulationSourceDto {
  name: string
  product: string
  reference_year: number
  resolution_m: number
  type: 'modelled_spatial_population'
}

export type PopulationConfidenceLevelDto = 'high' | 'moderate' | 'low' | 'very_low'

export type PopulationAgreementClassDto =
  | 'close'
  | 'moderate_difference'
  | 'large_difference'
  | 'extreme_difference'

export type PopulationRecommendedDisplayModeDto =
  | 'single_estimate'
  | 'estimate_with_uncertainty'
  | 'modelled_range'

export interface PopulationModelledRangeDto {
  lower: number
  upper: number
}

export interface PopulationZoneConfidenceDto {
  level: PopulationConfidenceLevelDto
  agreement_class: PopulationAgreementClassDto
  recommended_display_mode: PopulationRecommendedDisplayModeDto
  reasons: string[]
  disclaimer?: string
}

export interface PopulationZoneDto {
  radius_m: number
  estimated_population: number
  validation_estimate?: number
  difference_pct?: number
  modelled_range?: PopulationModelledRangeDto
  confidence?: PopulationZoneConfidenceDto
  density_per_km2: number
  data_coverage_pct: number
  warnings: string[]
}

export interface PopulationOfficialDepartmentDto {
  name: string
  official_population: number
  reference_year: number
  statistic_type: 'census' | 'projection'
  source: string
}

export interface PopulationOfficialContextDto {
  department: PopulationOfficialDepartmentDto | null
  municipality: PopulationOfficialDepartmentDto | null
  temporal_alignment: 'exact' | 'partial' | 'nearest' | 'mismatch'
}

export interface PopulationSettlementDto {
  name: string
  type: string
  distance_m: number
  source: string
  department?: string
  municipality?: string
}

export interface PopulationContextDto {
  status: PopulationContextStatus
  source: PopulationSourceDto
  generated_at: string
  context_version: string
  geometry_source: 'detections' | 'event_centroid_fallback'
  zones: PopulationZoneDto[]
  official_context: PopulationOfficialContextDto
  nearest_settlements: PopulationSettlementDto[]
  warnings: string[]
  disclaimer: string
}

export type PopulationEnrichmentQueueStatus =
  | 'queued'
  | 'processing'
  | 'complete'
  | 'failed'
  | 'unavailable'

export interface PopulationEnrichmentStateDto {
  status: PopulationEnrichmentQueueStatus
  message: string | null
}

export interface FireDepartmentOptionDto {
  code: string
  name: string
}

export interface FireEventListItemDto {
  id: string
  department_code: string | null
  department_name: string | null
  status: FireEventStatus
  validation_status: FireValidationStatus
  risk_level: FireRiskLevel
  priority_score: number
  centroid_lat: number | null
  centroid_lng: number | null
  first_detected_at: string
  last_detected_at: string
  persistence_hours: number | null
  detection_count: number
  satellite_count: number
  source_products: string[]
  max_frp_mw: number | null
  geometry_method: FireGeometryMethod | null
  cross_department: boolean
  created_at: string
}

export interface FireEventsFiltersDto {
  since?: string
  until?: string
  department_code?: string
  risk_level?: FireRiskLevel
  status?: FireEventStatus
  validation_status?: FireValidationStatus
  source_product?: string
  min_priority?: number
}

export interface FireEventsListDto {
  items: FireEventListItemDto[]
  pagination: {
    limit: number
    offset: number
    total: number
  }
  filters: FireEventsFiltersDto
  generated_at: string
}

export interface FireEventGeoJsonProperties {
  event_id: string
  department_code: string | null
  department_name: string | null
  status: string
  validation_status: string
  risk_level: string
  priority_score: number
  detection_count: number
  satellite_count: number
  last_detected_at: string
  geometry_method: string | null
  geometry_is_diagnostic: boolean
}

export interface FireEventGeoJsonFeature {
  type: 'Feature'
  id: string
  geometry: GeoJSON.Geometry
  properties: FireEventGeoJsonProperties
}

export interface FireEventsGeoJsonDto {
  type: 'FeatureCollection'
  features: FireEventGeoJsonFeature[]
  generated_at: string
}

export interface FireDetectionGeoJsonProperties {
  detection_id: string
  event_id: string
  acquired_at_utc: string
  source_product: string
  source_display_name: string
  satellite: string | null
  confidence_normalized: 'baja' | 'media' | 'alta' | null
  frp_mw: number | null
  daynight: string | null
}

export interface FireDetectionGeoJsonFeature {
  type: 'Feature'
  id: string
  geometry: GeoJSON.Point
  properties: FireDetectionGeoJsonProperties
}

export interface FireDetectionsGeoJsonDto {
  type: 'FeatureCollection'
  features: FireDetectionGeoJsonFeature[]
  generated_at: string
}

/** Campos prohibidos en respuestas públicas de la API. */
export const FIRE_SENSITIVE_FIELDS = [
  'raw_payload',
  'metadata',
  'event_geometry',
  'centroid',
  'dedup_key',
  'ingestion_run_id',
  'sanitized_request',
  'estimated_area_ha',
] as const
