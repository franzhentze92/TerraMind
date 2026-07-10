import { createHash } from 'node:crypto'

export const VALIDATION_MODEL_VERSION = '1.0.0'

export const VALIDATION_STATUSES = [
  'pending',
  'validating',
  'accepted',
  'accepted_with_limitations',
  'inconclusive',
  'rejected',
  'superseded',
  'withdrawn',
] as const

export type ValidationStatus = (typeof VALIDATION_STATUSES)[number]

export const REJECTION_REASON_CODES = [
  'unsupported_evidence_type',
  'corrupted_asset',
  'integrity_failure',
  'exact_duplicate',
  'outside_allowed_time_window',
  'irrelevant_to_requirement',
  'insufficient_identity_or_provenance',
  'missing_mandatory_content',
  'invalid_format',
  'withdrawn_by_submitter',
] as const

export type RejectionReasonCode = (typeof REJECTION_REASON_CODES)[number]

export const EVIDENCE_STRENGTH_LEVELS = [
  'very_low',
  'low',
  'moderate',
  'strong',
  'very_strong',
] as const

export type EvidenceStrength = (typeof EVIDENCE_STRENGTH_LEVELS)[number]

export const VALID_COVERAGE_STATUSES = [
  'valid_coverage',
  'valid_partial_coverage',
  'inconclusive_coverage',
  'invalid_coverage',
  'superseded_coverage',
] as const

export type ValidCoverageStatus = (typeof VALID_COVERAGE_STATUSES)[number]

export type ValidationPermission =
  | 'evidence.validate'
  | 'evidence.revalidate'
  | 'evidence.view_validation'
  | 'evidence.override_validation'
  | 'evidence.view_sensitive_metadata'

export interface ValidationScores {
  technical_integrity_score: number
  provenance_score: number
  temporal_relevance_score: number
  spatial_relevance_score: number
  semantic_relevance_score: number
  completeness_score: number
  source_independence_score: number
  usability_score: number
  overall_quality_score: number
}

export interface ValidationCheckResult {
  dimension: string
  check_code: string
  outcome: 'passed' | 'failed' | 'not_applicable' | 'warning'
  message: string
  weight: number
}

export interface RequirementLinkValidation {
  requirement_id: string
  evidence_type: string
  match_type: string
  valid_coverage_status: ValidCoverageStatus
  reason: string
}

export interface ConflictFlagResult {
  submission_id_a: string
  submission_id_b: string
  conflict_type: string
  conflict_field: string | null
  description: string
}

export interface ValidationSnapshot {
  submission_id: string
  submission_status: string
  evidence_type: string
  source_type: string
  submitted_by_id: string
  submitted_by_type: string
  submitted_at: string
  captured_at: string | null
  device_timestamp: string | null
  source_device: string | null
  source_application: string | null
  location_geometry: { type: 'Point'; coordinates: [number, number] } | null
  device_location_geometry: { type: 'Point'; coordinates: [number, number] } | null
  location_accuracy_m: number | null
  location_outside_mission_area: boolean
  location_discrepancy_m: number | null
  intake_status: string
  mission: {
    id: string
    earliest_start_at: string
    due_at: string
    expires_at: string
    location_geometry: { type: string; coordinates: number[][][] } | null
    last_detected_at: string | null
  }
  assets: Array<{
    id: string
    mime_type: string
    size_bytes: number
    checksum_sha256: string | null
    upload_confirmed: boolean
    mime_extension_mismatch: boolean
    width: number | null
    height: number | null
    duration_seconds: number | null
  }>
  observation: Record<string, unknown> | null
  requirement_links: Array<{
    requirement_id: string
    evidence_type: string
    match_type: string
    match_score: number
  }>
  peer_submissions: Array<{
    submission_id: string
    submitted_by_id: string
    source_type: string
    source_device: string | null
    captured_at: string | null
    observation: Record<string, unknown> | null
    validation_status: ValidationStatus | null
  }>
  is_exact_duplicate: boolean
  is_superseded: boolean
}

export interface ValidationDecisionResult {
  ok: boolean
  status: ValidationStatus
  rejection_reason_code: RejectionReasonCode | null
  decision_reason: string
  decision_rules: string[]
  limitations: string[]
  recommended_follow_up: string[]
  evidence_strength: EvidenceStrength
  scores: ValidationScores
  score_explanation: Record<string, string>
  checks: ValidationCheckResult[]
  requirement_links: RequirementLinkValidation[]
  conflict_flags: ConflictFlagResult[]
  context_signature: string
  warnings: string[]
}

export function hashValidationContext(parts: Record<string, unknown>): string {
  const canonical = JSON.stringify(parts, Object.keys(parts).sort())
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32)
}
