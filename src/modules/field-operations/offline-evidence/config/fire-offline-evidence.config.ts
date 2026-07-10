import type { LocalEvidenceType } from '@/modules/field-operations/offline-evidence/offline-evidence.types'

export const FIRE_OFFLINE_EVIDENCE_MODEL_VERSION = '1.0.0'

export const PHOTO_MIME_ALLOWLIST = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
export const VIDEO_MIME_ALLOWLIST = ['video/mp4', 'video/webm', 'video/quicktime']

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024
export const MAX_VIDEO_DURATION_SECONDS = 120
export const MAX_NOTE_LENGTH = 4000
export const LOW_STORAGE_WARNING_BYTES = 50 * 1024 * 1024

export const SCHEMA_TO_EVIDENCE_TYPE: Record<string, LocalEvidenceType> = {
  field_visual_observation: 'structured_observation',
  location_confirmation: 'location_confirmation',
  field_access_assessment: 'field_access_record',
  structured_negative_observation: 'negative_observation_context',
}

export const TASK_TYPE_EVIDENCE_HINTS: Record<string, LocalEvidenceType[]> = {
  capture_georeferenced_photos: ['georeferenced_photo', 'timestamped_photo'],
  structured_observation: ['structured_observation'],
  record_gps_position: ['location_confirmation'],
  navigate_to_area: ['field_access_record'],
  record_visible_indicators: ['negative_observation_context'],
  submit_evidence: ['timestamped_note'],
}

export const CRITICAL_EVIDENCE_TYPES = new Set<LocalEvidenceType>([
  'georeferenced_photo',
  'structured_observation',
])

export const METADATA_KEY_LABELS: Record<string, string> = {
  lat: 'Latitud',
  lon: 'Longitud',
  timestamp: 'Marca de tiempo',
  orientation: 'Orientación',
}

export function evidenceTypeForSchema(schemaId: string): LocalEvidenceType | null {
  return SCHEMA_TO_EVIDENCE_TYPE[schemaId] ?? null
}

export function isMimeAllowed(mime: string, kind: 'photo' | 'video'): boolean {
  const list = kind === 'photo' ? PHOTO_MIME_ALLOWLIST : VIDEO_MIME_ALLOWLIST
  return list.includes(mime)
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
}
