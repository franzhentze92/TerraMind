import type { EvidencePermission } from '@/modules/evidence/evidence-intake.types'

export const EVIDENCE_INTAKE_PROFILE_VERSION = '1.0.0'

export const ALL_EVIDENCE_PERMISSIONS: EvidencePermission[] = [
  'evidence.submit',
  'evidence.view',
  'evidence.withdraw',
  'evidence.link_requirement',
  'evidence.view_sensitive_metadata',
]

export const ACTION_REQUIRED_PERMISSION: Record<string, EvidencePermission> = {
  create_submission: 'evidence.submit',
  upload_url: 'evidence.submit',
  confirm_upload: 'evidence.submit',
  add_observation: 'evidence.submit',
  withdraw: 'evidence.withdraw',
  link_requirement: 'evidence.link_requirement',
  view: 'evidence.view',
}

export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  georeferenced_photo: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  timestamped_photo: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  drone_image: ['image/jpeg', 'image/png', 'image/webp'],
  video: ['video/mp4', 'video/quicktime'],
  external_document: ['application/pdf', 'text/plain', 'application/json'],
}

export const MAX_FILE_SIZE_BYTES = 52_428_800
export const MAX_ASSETS_PER_SUBMISSION = 10
export const UPLOAD_URL_TTL_SECONDS = 900
export const SUBMISSION_UPLOAD_EXPIRY_HOURS = 24

export const EXTENSION_MIME_MAP: Record<string, string[]> = {
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
  heic: ['image/heic'],
  mp4: ['video/mp4'],
  mov: ['video/quicktime'],
  pdf: ['application/pdf'],
  txt: ['text/plain'],
  json: ['application/json'],
}

export const FIRE_STRUCTURED_OBSERVATION_SCHEMA = 'fire_field_observation_v1'

export const FIRE_STRUCTURED_OBSERVATION_FIELDS = [
  'visible_smoke',
  'visible_flame',
  'burned_vegetation_indicators',
  'heat_source_observed',
  'possible_non_vegetation_heat_source',
  'approximate_extent',
  'observation_distance_m',
  'visibility_conditions',
  'access_limitations',
  'observer_notes',
] as const

export const TRI_STATE_VALUES = ['yes', 'no', 'uncertain'] as const

export const METADATA_REQUIREMENTS_BY_TYPE: Record<string, string[]> = {
  georeferenced_photo: ['captured_at', 'location'],
  timestamped_photo: ['captured_at'],
  drone_image: ['captured_at', 'location'],
  video: ['captured_at'],
  structured_observation: ['observation_schema'],
  timestamped_note: ['captured_at'],
  location_confirmation: ['location'],
  satellite_review_result: ['captured_at'],
  time_series_review_result: ['captured_at'],
  institutional_response: ['captured_at'],
  external_document: ['captured_at'],
}

/** Fixtures sintéticos — solo pruebas, no se insertan en producción */
export const SYNTHETIC_EVIDENCE_FIXTURES = {
  mission: {
    id: 'fixture-mission-1',
    incident_id: 'fixture-incident-1',
    verification_plan_id: 'fixture-plan-1',
    status: 'in_progress',
    location_geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-90.52, 14.63],
          [-90.50, 14.63],
          [-90.50, 14.65],
          [-90.52, 14.65],
          [-90.52, 14.63],
        ],
      ],
    },
  },
  requirements: [
    {
      id: 'fixture-req-photo',
      evidence_type: 'georeferenced_photo',
      required: true,
      minimum_count: 1,
      required_metadata: ['captured_at', 'location'],
      verification_need_id: 'fixture-need-1',
    },
    {
      id: 'fixture-req-obs',
      evidence_type: 'structured_observation',
      required: true,
      minimum_count: 1,
      required_metadata: ['observation_schema'],
      verification_need_id: 'fixture-need-1',
    },
  ],
  photo_asset: {
    original_filename: 'campo_001.jpg',
    mime_type: 'image/jpeg',
    size_bytes: 204800,
    checksum_sha256: 'abc123def4567890abcdef1234567890abcdef1234567890abcdef1234567890',
  },
  duplicate_checksum: 'abc123def4567890abcdef1234567890abcdef1234567890abcdef1234567890',
  observation: {
    visible_smoke: 'yes',
    visible_flame: 'no',
    burned_vegetation_indicators: 'uncertain',
    heat_source_observed: 'no',
    possible_non_vegetation_heat_source: 'no',
    approximate_extent: 'menos de 1 ha',
    observation_distance_m: 120,
    visibility_conditions: 'nublado',
    access_limitations: 'sendero cerrado',
    observer_notes: 'Evidencia recibida desde punto de observación',
  },
  outside_location: {
    type: 'Point' as const,
    coordinates: [-90.40, 14.50] as [number, number],
  },
  inside_location: {
    type: 'Point' as const,
    coordinates: [-90.51, 14.64] as [number, number],
  },
}
