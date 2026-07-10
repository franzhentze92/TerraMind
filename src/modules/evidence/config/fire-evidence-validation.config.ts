import type { ValidationPermission } from '@/modules/evidence/validation/evidence-validation.types'

export const VALIDATION_MODEL_VERSION = '1.0.0'

export const ALL_VALIDATION_PERMISSIONS: ValidationPermission[] = [
  'evidence.validate',
  'evidence.revalidate',
  'evidence.view_validation',
  'evidence.override_validation',
  'evidence.view_sensitive_metadata',
]

export const VALIDATION_ACTION_PERMISSION: Record<string, ValidationPermission> = {
  validate: 'evidence.validate',
  revalidate: 'evidence.revalidate',
  view: 'evidence.view_validation',
}

export const SCORE_WEIGHTS = {
  technical_integrity: 0.15,
  provenance: 0.1,
  temporal_relevance: 0.15,
  spatial_relevance: 0.15,
  semantic_relevance: 0.2,
  completeness: 0.1,
  source_independence: 0.05,
  usability: 0.1,
} as const

export const ACCEPTED_MIN_OVERALL = 70
export const ACCEPTED_WITH_LIMITATIONS_MIN = 50
export const STRENGTH_THRESHOLDS = {
  very_strong: 85,
  strong: 70,
  moderate: 55,
  low: 40,
  very_low: 0,
} as const

export const NEGATIVE_OBSERVATION_FIELDS = [
  'visible_smoke',
  'visible_flame',
  'burned_vegetation_indicators',
  'heat_source_observed',
] as const

export const CONFLICT_OBSERVATION_FIELDS = [
  'visible_smoke',
  'visible_flame',
  'burned_vegetation_indicators',
] as const

/** Fixtures sintéticos — solo pruebas */
export const SYNTHETIC_VALIDATION_FIXTURES = {
  mission: {
    id: 'fixture-mission-val',
    earliest_start_at: '2026-07-09T00:00:00.000Z',
    due_at: '2026-07-11T12:00:00.000Z',
    expires_at: '2026-07-12T00:00:00.000Z',
    last_detected_at: '2026-07-10T08:00:00.000Z',
    location_geometry: {
      type: 'Polygon' as const,
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
  complete_photo: {
    submission_id: 'sub-complete',
    evidence_type: 'georeferenced_photo',
    captured_at: '2026-07-10T10:00:00.000Z',
    submitted_at: '2026-07-10T11:00:00.000Z',
    location: { type: 'Point' as const, coordinates: [-90.51, 14.64] as [number, number] },
    assets: [
      {
        id: 'asset-1',
        mime_type: 'image/jpeg',
        size_bytes: 204800,
        checksum_sha256: 'a'.repeat(64),
        upload_confirmed: true,
        mime_extension_mismatch: false,
        width: 1920,
        height: 1080,
        duration_seconds: null,
      },
    ],
  },
  partial_metadata: {
    submission_id: 'sub-partial',
    captured_at: null,
    location: null,
    assets: [
      {
        id: 'asset-p',
        mime_type: 'image/jpeg',
        size_bytes: 102400,
        checksum_sha256: 'b'.repeat(64),
        upload_confirmed: true,
        mime_extension_mismatch: false,
        width: 800,
        height: 600,
        duration_seconds: null,
      },
    ],
  },
  corrupted: {
    assets: [
      {
        id: 'asset-c',
        mime_type: 'image/jpeg',
        size_bytes: 0,
        checksum_sha256: null,
        upload_confirmed: true,
        mime_extension_mismatch: true,
        width: null,
        height: null,
        duration_seconds: null,
      },
    ],
  },
  outside_area: {
    location: { type: 'Point' as const, coordinates: [-90.40, 14.50] as [number, number] },
    location_outside_mission_area: true,
  },
  negative_observation: {
    observation: {
      visible_smoke: 'no',
      visible_flame: 'no',
      burned_vegetation_indicators: 'no',
      observation_distance_m: 200,
      visibility_conditions: 'clara',
      observer_notes: 'Sin humo visible desde punto de observación',
    },
  },
  smoke_positive: {
    submission_id: 'sub-smoke-yes',
    observation: { visible_smoke: 'yes', visible_flame: 'uncertain' },
  },
  smoke_negative: {
    submission_id: 'sub-smoke-no',
    observation: { visible_smoke: 'no', visible_flame: 'no' },
  },
  requirements: [
    {
      requirement_id: 'req-photo',
      evidence_type: 'georeferenced_photo',
      match_type: 'matched',
      match_score: 1,
    },
    {
      requirement_id: 'req-obs',
      evidence_type: 'structured_observation',
      match_type: 'not_matched',
      match_score: 0,
    },
  ],
}
