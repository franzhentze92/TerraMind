import type {
  NewsGeographicStatus,
  NewsPreliminaryCategory,
  NewsProcessingStatus,
} from './news.types'

export interface NewsSourceDto {
  id: string
  code: string
  name: string
  source_type: string
  country_code: string
  primary_language: string
  base_url: string
  logo_url: string | null
  discovery_method: string
  is_enabled: boolean
  last_successful_ingestion_at: string | null
  last_failed_ingestion_at: string | null
  consecutive_failure_count: number
}

export interface NewsDocumentListItemDto {
  id: string
  source_id: string
  source_name: string
  source_code: string
  title: string
  canonical_url: string
  published_at: string | null
  source_category: string | null
  preliminary_category: NewsPreliminaryCategory | null
  preliminary_category_label: string | null
  geographic_status: NewsGeographicStatus
  geographic_status_label: string
  location_label: string | null
  processing_status: NewsProcessingStatus
  processing_status_label: string
  permitted_excerpt: string | null
  image_reference_url: string | null
  /** Texto específico de ubicación (p. ej. "Zona 15, Ciudad de Guatemala"). */
  location_display: string
  primary_location: {
    name?: string
    department_name?: string
    municipality_name?: string
    latitude?: number
    longitude?: number
    level?: string
  } | null
}

export interface NewsDocumentDetailDto extends NewsDocumentListItemDto {
  subtitle: string | null
  author_names: string[]
  modified_at: string | null
  captured_at: string
  description: string | null
  source_tags: string[]
  access_policy_label: string
  content_retention_label: string
  preliminary_category_confidence: number | null
  preliminary_category_reasons: string[]
  location_candidates: Array<{
    name: string
    department_name?: string
    confidence: number
    evidence: string
    level: string
  }>
  system_analysis: {
    category_proposed: string | null
    category_confidence: number | null
    category_reasons: string[]
    location_proposed: string | null
    location_confidence: number | null
    geographic_status_label: string
    event_grouping_status: string
  }
  provenance: {
    source_name: string
    discovery_method: string
    captured_at: string
    canonical_url: string
  }
  update_history: Array<{
    at: string
    fields: string[]
  }>
  raw_metadata_summary: Record<string, unknown>
}

export interface NewsGeographicDistributionDto {
  localizada: number
  ubicacion_aproximada: number
  varias_ubicaciones: number
  nacional: number
  internacional: number
  sin_ubicacion: number
}

export interface NewsSummaryDto {
  documents_captured: number
  active_sources: number
  last_ingestion_at: string | null
  documents_with_location: number
  ready_for_analysis: number
  total_ingestion_runs: number
  geographic_distribution: NewsGeographicDistributionDto
  period_hours: number
}

export interface NewsIngestionRunDto {
  id: string
  source_id: string
  source_name: string
  started_at: string
  finished_at: string | null
  discovery_method: string
  urls_discovered: number
  documents_new: number
  documents_updated: number
  duplicates: number
  revalidated: number
  restricted: number
  errors: number
  http_requests_made: number
  http_requests_avoided: number
  duration_ms: number | null
  result_code: string
  message: string | null
  connector_version: string
}

export interface NewsIngestionResultDto {
  run: NewsIngestionRunDto
  inspection?: Record<string, unknown>
}
