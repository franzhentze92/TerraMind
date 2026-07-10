export const OFFLINE_EVIDENCE_MODEL_VERSION = '1.0.0'

export const LOCAL_EVIDENCE_TYPES = [
  'georeferenced_photo',
  'timestamped_photo',
  'video',
  'structured_observation',
  'timestamped_note',
  'location_confirmation',
  'field_access_record',
  'negative_observation_context',
] as const

export type LocalEvidenceType = (typeof LOCAL_EVIDENCE_TYPES)[number]

export const LOCAL_EVIDENCE_STATUSES = [
  'draft',
  'capturing',
  'processing',
  'incomplete',
  'ready',
  'pending_sync',
  'sync_blocked',
  'duplicate',
  'superseded',
  'deleted_pending_sync',
  'corrupted',
] as const

export type LocalEvidenceStatus = (typeof LOCAL_EVIDENCE_STATUSES)[number]

export const MATCH_TYPES = ['potential_match', 'matched', 'partial_match', 'not_matched'] as const
export type RequirementMatchType = (typeof MATCH_TYPES)[number]

export const COVERAGE_STATUSES = [
  'none',
  'partial',
  'complete_preliminary',
  'blocked',
  'unknown',
] as const

export type CoverageStatus = (typeof COVERAGE_STATUSES)[number]

export const DUPLICATE_KINDS = ['exact_duplicate', 'possible_duplicate', 'related_asset'] as const
export type DuplicateKind = (typeof DUPLICATE_KINDS)[number]

export const PRIVACY_CLASSIFICATIONS = ['internal', 'restricted', 'sensitive_location'] as const
export type PrivacyClassification = (typeof PRIVACY_CLASSIFICATIONS)[number]

export interface GeoLocationCapture {
  lat: number | null
  lng: number | null
  accuracy_m: number | null
  altitude_m?: number | null
  heading?: number | null
  method: 'device_gps' | 'manual' | 'unavailable' | 'denied'
  captured_at: string
  permission: 'granted' | 'denied' | 'unavailable'
}

export interface TimestampCapture {
  device_timestamp: string
  app_captured_at: string
  timezone: string
  utc_offset_minutes: number
  clock_skew_warning: boolean
}

export interface LocalEvidenceRecord {
  local_evidence_id: string
  package_id: string
  package_version: number
  mission_id: string
  task_id: string
  requirement_ids: string[]
  verification_need_ids: string[]
  form_response_id: string | null
  evidence_type: LocalEvidenceType
  status: LocalEvidenceStatus
  captured_at: string
  device_timestamp: string
  created_at: string
  updated_at: string
  location: GeoLocationCapture | null
  location_accuracy_m: number | null
  source: 'camera' | 'file_picker' | 'form_output' | 'manual_note' | 'gps_capture'
  metadata: Record<string, unknown>
  limitations: string[]
  checksum: string
  local_revision: number
  context_signature: string
  privacy_classification: PrivacyClassification
  structured_payload: Record<string, unknown> | null
  form_output_checksum: string | null
  tab_id: string | null
}

export interface LocalEvidenceAsset {
  local_asset_id: string
  local_evidence_id: string
  asset_type: 'photo' | 'video' | 'note_blob'
  blob_reference: string
  original_filename: string
  mime_type: string
  size_bytes: number
  sha256: string
  width: number | null
  height: number | null
  duration_seconds: number | null
  captured_at: string
  metadata: Record<string, unknown>
  storage_backend: 'indexeddb' | 'memory'
  created_at: string
}

export interface LocalEvidenceRequirementLink {
  local_evidence_id: string
  requirement_id: string
  match_type: RequirementMatchType
  match_score: number
  match_reasons: string[]
  coverage_status: CoverageStatus
}

export interface LocalEvidenceEvent {
  event_id: string
  local_evidence_id: string | null
  bundle_id: string | null
  event_type: string
  payload: Record<string, unknown>
  created_at: string
}

export interface LocalEvidenceBundle {
  bundle_id: string
  package_id: string
  package_version: number
  mission_id: string
  task_id: string
  form_response_ids: string[]
  evidence_record_ids: string[]
  requirement_links: LocalEvidenceRequirementLink[]
  captured_at_range: { start: string | null; end: string | null }
  location_summary: Record<string, unknown>
  limitations: string[]
  bundle_checksum: string
  status: 'incomplete' | 'ready' | 'pending_sync' | 'sync_blocked' | 'superseded'
  size_bytes: number
  supersedes_bundle_id: string | null
  created_at: string
  updated_at: string
  tab_id: string | null
}

export interface RequirementCoverageSummary {
  requirement_id: string
  evidence_type: string
  minimum_count: number
  captured_count: number
  missing_count: number
  coverage_status: CoverageStatus
  warnings: string[]
  required_metadata: string[]
  metadata_missing: string[]
}

export interface CaptureContext {
  package_id: string
  package_version: number
  mission_id: string
  task_id: string
  context_signature: string
  tab_id: string
  package_local_status: string
  now_iso: string
}

export interface ParsedEvidenceRequirement {
  id: string
  evidence_type: string
  required: boolean
  minimum_count: number
  required_metadata: string[]
  verification_need_id: string | null
}
