export const EVIDENCE_INTAKE_PROFILE_VERSION = '1.0.0'

export const EVIDENCE_TYPES = [
  'georeferenced_photo',
  'timestamped_photo',
  'video',
  'structured_observation',
  'timestamped_note',
  'location_confirmation',
  'satellite_review_result',
  'time_series_review_result',
  'institutional_response',
  'drone_image',
  'external_document',
] as const

export type EvidenceType = (typeof EVIDENCE_TYPES)[number]

export const EVIDENCE_SUBMISSION_STATUSES = [
  'received',
  'processing',
  'ready_for_validation',
  'incomplete',
  'duplicate',
  'unsupported',
  'processing_failed',
  'withdrawn',
] as const

export type EvidenceSubmissionStatus = (typeof EVIDENCE_SUBMISSION_STATUSES)[number]

export const EVIDENCE_SOURCE_TYPES = [
  'mission_user',
  'institution',
  'citizen',
  'sensor',
  'satellite_provider',
  'system_generated',
  'external_api',
] as const

export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number]

export const REQUIREMENT_MATCH_TYPES = [
  'potential_match',
  'matched',
  'partial_match',
  'not_matched',
] as const

export type RequirementMatchType = (typeof REQUIREMENT_MATCH_TYPES)[number]

export const SENSITIVITY_CLASSIFICATIONS = [
  'public',
  'internal',
  'restricted',
  'sensitive_location',
] as const

export type SensitivityClassification = (typeof SENSITIVITY_CLASSIFICATIONS)[number]

export type EvidencePermission =
  | 'evidence.submit'
  | 'evidence.view'
  | 'evidence.withdraw'
  | 'evidence.link_requirement'
  | 'evidence.view_sensitive_metadata'

export interface EvidenceActor {
  actor_type: 'user' | 'system'
  actor_id: string | null
  permissions: EvidencePermission[]
}

export interface EvidenceLocation {
  geometry: { type: 'Point'; coordinates: [number, number] } | null
  accuracy_m?: number | null
  method?: string | null
  device_geometry?: { type: 'Point'; coordinates: [number, number] } | null
}

export interface EvidenceSubmissionInput {
  mission_id: string
  mission_task_id?: string | null
  verification_need_id?: string | null
  source_type: EvidenceSourceType
  evidence_type: EvidenceType
  description?: string
  captured_at?: string | null
  device_timestamp?: string | null
  location?: EvidenceLocation
  source_device?: string | null
  source_application?: string | null
  metadata?: Record<string, unknown>
  sensitivity_classification?: SensitivityClassification
  requirement_ids?: string[]
  idempotency_key?: string | null
  actor: EvidenceActor
}

export interface EvidenceAssetInput {
  original_filename: string
  mime_type: string
  size_bytes: number
  checksum_sha256?: string | null
  captured_at?: string | null
  width?: number | null
  height?: number | null
  duration_seconds?: number | null
  embedded_metadata?: Record<string, unknown>
  idempotency_key?: string | null
}

export interface StructuredObservationInput {
  fields: Record<string, unknown>
}

export interface EvidenceRequirementSnapshot {
  id: string
  evidence_type: string
  required: boolean
  minimum_count: number
  required_metadata: string[]
  verification_need_id: string | null
}

export interface EvidenceRequirementLinkResult {
  requirement_id: string
  match_type: RequirementMatchType
  match_score: number
  match_reason: string
  preliminary_coverage: RequirementMatchType
}

export interface EvidenceIntegrityResult {
  valid: boolean
  checksum_valid: boolean
  size_valid: boolean
  mime_valid: boolean
  extension_mismatch: boolean
  reasons: string[]
  warnings: string[]
}

export interface EvidenceDeduplicationResult {
  duplicate_class: 'none' | 'exact_duplicate' | 'possible_duplicate' | 'related_distinct'
  duplicate_of_submission_id: string | null
  duplicate_of_asset_id: string | null
  reasons: string[]
}

export interface EvidenceProcessingResult {
  ok: boolean
  submission_status: EvidenceSubmissionStatus
  integrity: EvidenceIntegrityResult
  deduplication: EvidenceDeduplicationResult
  requirement_links: EvidenceRequirementLinkResult[]
  missing_metadata: string[]
  location_outside_mission_area: boolean
  location_discrepancy_m: number | null
  reasons: string[]
  warnings: string[]
}

export interface EvidenceCoverageItem {
  requirement_id: string
  evidence_type: string
  required: boolean
  minimum_count: number
  submission_count: number
  preliminary_status: 'none' | 'received' | 'partial' | 'ready_for_validation' | 'unlinked'
  linked_submission_ids: string[]
}

export interface EvidenceCoverageSnapshot {
  mission_id: string
  requirements: EvidenceCoverageItem[]
  unlinked_submission_ids: string[]
  generated_at: string
}

export interface EvidenceIntakeEvaluationResult {
  ok: boolean
  action: string
  submission_id: string | null
  submission_status: EvidenceSubmissionStatus | null
  reasons: string[]
  warnings: string[]
  idempotent_replay: boolean
}
