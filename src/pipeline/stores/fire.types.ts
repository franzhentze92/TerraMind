export type IngestionRunStatus = 'running' | 'success' | 'partial' | 'failed'

export interface FireDetectionRow {
  dedup_key: string
  ingestion_run_id: string
  source_product: string
  satellite: string | null
  instrument: string | null
  data_version: string | null
  latitude: number
  longitude: number
  acquired_at_utc: string
  first_seen_at: string
  last_seen_at: string
  ingested_at: string
  confidence_raw: string | null
  confidence_normalized: 'baja' | 'media' | 'alta' | null
  detection_label: string
  frp_mw: number | null
  brightness: number | null
  daynight: string | null
  country_code: null
  is_inside_guatemala: null
  department_id: null
  municipality_id: null
  geography_method: 'unresolved'
  geography_confidence: null
  raw_payload: Record<string, unknown>
}

export interface UpsertMetrics {
  inserted: number
  updated: number
  duplicated: number
}

export interface IngestionRunRecord {
  id: string
  started_at: string
  completed_at: string | null
  status: IngestionRunStatus
  source: string
  sources_queried: string[]
  day_range: number
  sanitized_request: unknown[]
  http_status: Record<string, number>
  rows_received: number
  rows_valid: number
  rows_rejected: number
  rows_inserted: number
  rows_updated: number
  rows_duplicated: number
  rows_outside_country: number
  duration_ms: number | null
  error_message: string | null
  metadata: Record<string, unknown>
}
