import type { LocalEvidenceType } from '@/modules/field-operations/offline-evidence/offline-evidence.types'
import type { EvidenceType } from '@/modules/evidence/evidence-intake.types'

export const FIRE_FIELD_SYNC_MODEL_VERSION = '1.0.0'

export const SYNC_CHUNK_SIZE_BYTES = 256 * 1024
export const MAX_CONCURRENT_ASSET_UPLOADS = 2
export const MAX_SYNC_ATTEMPTS = 8
export const BASE_RETRY_MS = 2_000
export const MAX_RETRY_MS = 120_000
export const UPLOAD_URL_RENEW_BUFFER_MS = 60_000
export const PROCESSING_POLL_MS = 500
export const PROCESSING_POLL_MAX = 40

export const OFFLINE_TO_REMOTE_EVIDENCE_TYPE: Record<LocalEvidenceType, EvidenceType> = {
  georeferenced_photo: 'georeferenced_photo',
  timestamped_photo: 'timestamped_photo',
  video: 'video',
  structured_observation: 'structured_observation',
  timestamped_note: 'timestamped_note',
  location_confirmation: 'location_confirmation',
  field_access_record: 'structured_observation',
  negative_observation_context: 'structured_observation',
}

export const PERMANENT_ERROR_CODES = new Set([
  'mission_cancelled',
  'package_revoked',
  'permission_denied',
  'checksum_mismatch',
  'remote_rejected',
  'unsupported_evidence_type',
])

export function mapLocalEvidenceType(type: LocalEvidenceType): EvidenceType {
  return OFFLINE_TO_REMOTE_EVIDENCE_TYPE[type] ?? 'structured_observation'
}

export function computeRetryDelay(attempt: number): number {
  const exp = Math.min(BASE_RETRY_MS * 2 ** attempt, MAX_RETRY_MS)
  const jitter = Math.floor(Math.random() * 500)
  return exp + jitter
}
