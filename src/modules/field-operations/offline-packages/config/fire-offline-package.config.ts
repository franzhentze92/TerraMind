import type { MissionType } from '@/modules/missions/missions.types'
import type { OfflineFormSchema, OfflinePackagePermission } from '@/modules/field-operations/offline-packages/offline-package.types'

export const FIRE_OFFLINE_PACKAGE_MODEL_VERSION = '1.0.0'

export const OFFLINE_PACKAGE_ELIGIBLE_STATUSES = [
  'ready',
  'approved',
  'assigned',
  'in_progress',
] as const

export const OFFLINE_PACKAGE_HISTORICAL_STATUSES = [
  'completed',
  'inconclusive',
  'cancelled',
  'expired',
  'failed',
] as const

export const OFFLINE_PACKAGE_BLOCKED_STATUSES = ['draft'] as const

export const OFFLINE_CAPABLE_MISSION_TYPES: MissionType[] = [
  'field_visual_inspection',
  'georeferenced_photo_collection',
  'drone_observation',
  'protected_area_staff_observation',
]

export const ASSIGNMENT_REQUIRED_STATUSES = ['assigned', 'in_progress'] as const

export const PACKAGE_VALIDITY_HOURS = 72
export const DOWNLOAD_LINK_VALIDITY_HOURS = 24

export const MATERIAL_CHANGE_FIELDS = [
  'mission_type',
  'title',
  'objective',
  'location_geometry',
  'earliest_start_at',
  'due_at',
  'expires_at',
  'blocking_conditions',
  'cancellation_conditions',
  'completion_criteria',
  'inconclusive_criteria',
] as const

export const SENSITIVE_FIELD_PATHS = [
  'reporter_identity',
  'reporter_contact',
  'administrative_notes',
  'internal_comments',
  'denunciante',
  'species_exact_location',
  'critical_infrastructure_detail',
] as const

export const OFFLINE_PACKAGE_PERMISSIONS: OfflinePackagePermission[] = [
  'offline_packages.generate',
  'offline_packages.download',
  'offline_packages.view',
  'offline_packages.revoke',
  'offline_packages.view_sensitive',
  'offline_packages.download_historical',
]

export const ACTION_REQUIRED_PERMISSION: Record<string, OfflinePackagePermission> = {
  generate: 'offline_packages.generate',
  download: 'offline_packages.download',
  view: 'offline_packages.view',
  revoke: 'offline_packages.revoke',
  view_sensitive: 'offline_packages.view_sensitive',
  download_historical: 'offline_packages.download_historical',
}

export const FIELD_OBSERVATION_FORM: OfflineFormSchema = {
  schema_id: 'fire-field-observation-v1',
  schema_version: '1.0.0',
  json_schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['observation_time', 'visibility', 'indicators'],
    properties: {
      observation_time: { type: 'string', format: 'date-time' },
      visibility: {
        type: 'string',
        enum: ['clear', 'partial', 'obstructed', 'unknown'],
      },
      indicators: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'smoke_visible',
            'flame_visible',
            'heat_signature_only',
            'no_visible_activity',
            'access_blocked',
          ],
        },
      },
      notes: { type: 'string', maxLength: 2000 },
    },
    additionalProperties: false,
  },
  ui_schema: {
    notes: { 'ui:widget': 'textarea', 'ui:rows': 4 },
  },
  validation_rules: {
    notes: { forbidden_pattern_ids: ['confirmed_fire_claim', 'extinction_claim'] },
  },
  conditional_rules: [],
  localization: {
    'observation_time.label': 'Hora de observación',
    'visibility.label': 'Visibilidad',
    'indicators.label': 'Indicadores visibles',
    'notes.label': 'Notas operacionales',
  },
}

export const GEO_PHOTO_FORM: OfflineFormSchema = {
  schema_id: 'fire-geophoto-v1',
  schema_version: '1.0.0',
  json_schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['capture_count', 'orientation_notes'],
    properties: {
      capture_count: { type: 'integer', minimum: 1, maximum: 20 },
      orientation_notes: { type: 'string', maxLength: 500 },
      weather_conditions: {
        type: 'string',
        enum: ['clear', 'cloudy', 'rain', 'smoke_haze', 'unknown'],
      },
    },
    additionalProperties: false,
  },
  ui_schema: {},
  validation_rules: {},
  conditional_rules: [],
  localization: {
    'capture_count.label': 'Número de capturas planificadas',
    'orientation_notes.label': 'Orientación aproximada',
  },
}

export const MISSION_TYPE_FORMS: Partial<Record<MissionType, OfflineFormSchema[]>> = {
  field_visual_inspection: [FIELD_OBSERVATION_FORM],
  georeferenced_photo_collection: [GEO_PHOTO_FORM, FIELD_OBSERVATION_FORM],
  drone_observation: [FIELD_OBSERVATION_FORM],
  protected_area_staff_observation: [FIELD_OBSERVATION_FORM],
}

export const GENERAL_FIELD_INSTRUCTIONS =
  'Ejecutar la misión respetando restricciones de acceso. Documentar observaciones con lenguaje operacional conservador.'

export const SAFETY_INSTRUCTIONS = [
  'No ingresar a áreas inaccesibles o de riesgo elevado.',
  'Mantener distancia segura ante humo denso o llama visible.',
  'Registrar limitaciones de visibilidad como inconclusas, no como ausencia de actividad.',
]

export const DEFAULT_EXPECTED_ACCURACY_M = 25

export function formsForMissionType(missionType: string): OfflineFormSchema[] {
  return MISSION_TYPE_FORMS[missionType as MissionType] ?? [FIELD_OBSERVATION_FORM]
}
