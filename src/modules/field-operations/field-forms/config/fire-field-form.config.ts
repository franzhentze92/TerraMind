import type { FieldFormSchemaRecord } from '@/modules/field-operations/field-forms/field-form.types'

export const FIRE_FIELD_FORM_MODEL_VERSION = '1.0.0'
export const FIRE_FIELD_FORM_DOMAIN = 'fire'

const NOW = '2026-07-10T00:00:00.000Z'

export const FIELD_VISUAL_OBSERVATION_SCHEMA: FieldFormSchemaRecord = {
  schema_id: 'field_visual_observation',
  schema_version: '1.0.0',
  domain: FIRE_FIELD_FORM_DOMAIN,
  mission_type: 'field_visual_inspection',
  task_type: 'structured_observation',
  evidence_type: 'structured_observation',
  json_schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['observation_datetime', 'visibility_conditions', 'access_possible'],
    properties: {
      observation_datetime: { type: 'string', format: 'date-time' },
      device_location: {
        type: 'object',
        properties: {
          lat: { type: 'number' },
          lng: { type: 'number' },
          accuracy_m: { type: 'number', minimum: 0 },
        },
      },
      target_distance_m: { type: 'number', minimum: 0 },
      visibility_conditions: {
        type: 'string',
        enum: ['clear', 'partial', 'poor', 'obstructed', 'unknown'],
      },
      access_possible: { type: 'string', enum: ['yes', 'no', 'partial', 'uncertain'] },
      visible_smoke: { type: 'string', enum: ['yes', 'no', 'uncertain'] },
      visible_flame: { type: 'string', enum: ['yes', 'no', 'uncertain'] },
      burned_vegetation_indicators: { type: 'string', enum: ['yes', 'no', 'uncertain'] },
      heat_source_observed: { type: 'string', enum: ['yes', 'no', 'uncertain'] },
      possible_non_vegetation_heat_source: { type: 'string', enum: ['yes', 'no', 'uncertain'] },
      smoke_intensity: { type: 'string', enum: ['light', 'moderate', 'dense', 'unknown'] },
      smoke_direction: { type: 'string', maxLength: 120 },
      smoke_color: { type: 'string', maxLength: 80 },
      approximate_extent_ha: { type: 'number', minimum: 0 },
      observed_direction: { type: 'string', maxLength: 120 },
      non_vegetation_type: { type: 'string', maxLength: 200 },
      non_vegetation_location_notes: { type: 'string', maxLength: 500 },
      uncertainty_notes: { type: 'string', maxLength: 500 },
      limitations: { type: 'string', maxLength: 1000 },
      notes: { type: 'string', maxLength: 2000 },
    },
    additionalProperties: false,
  },
  ui_schema: {
    observation_datetime: { 'ui:widget': 'datetime' },
    device_location: { 'ui:widget': 'coordinates' },
    target_distance_m: { 'ui:widget': 'distance' },
    visibility_conditions: { 'ui:widget': 'select' },
    access_possible: { 'ui:widget': 'yes_no_uncertain' },
    visible_smoke: { 'ui:widget': 'yes_no_uncertain' },
    visible_flame: { 'ui:widget': 'yes_no_uncertain' },
    burned_vegetation_indicators: { 'ui:widget': 'yes_no_uncertain' },
    heat_source_observed: { 'ui:widget': 'yes_no_uncertain' },
    possible_non_vegetation_heat_source: { 'ui:widget': 'yes_no_uncertain' },
    smoke_intensity: { 'ui:widget': 'select' },
    limitations: { 'ui:widget': 'textarea', 'ui:rows': 3 },
    notes: { 'ui:widget': 'textarea', 'ui:rows': 4 },
  },
  conditional_rules: [
    {
      id: 'smoke-yes-details',
      when: { field: 'visible_smoke', equals: 'yes' },
      then: {
        show: ['smoke_intensity', 'smoke_direction', 'smoke_color'],
        require: ['smoke_intensity'],
        warn: ['photo_required_later'],
      },
    },
    {
      id: 'access-no-reason',
      when: { field: 'access_possible', equals: 'no' },
      then: {
        show: ['limitations'],
        require: ['limitations'],
      },
    },
    {
      id: 'non-veg-heat',
      when: { field: 'possible_non_vegetation_heat_source', equals: 'yes' },
      then: {
        show: ['non_vegetation_type', 'non_vegetation_location_notes', 'uncertainty_notes'],
        require: ['non_vegetation_type'],
      },
    },
    {
      id: 'poor-visibility',
      when: { field: 'visibility_conditions', equals: 'poor' },
      then: {
        require: ['limitations'],
        set_status_hint: 'complete_with_limitations',
      },
    },
  ],
  validation_rules: {
    notes: { forbidden_pattern_ids: ['confirmed_fire_claim', 'extinction_claim'] },
    limitations: { forbidden_pattern_ids: ['confirmed_fire_claim', 'extinction_claim'] },
    device_location: { min_accuracy_m_informative: 100 },
  },
  localization: {
    'observation_datetime.label': 'Fecha y hora de observación',
    'visibility_conditions.label': 'Condiciones de visibilidad',
    'access_possible.label': '¿Acceso posible?',
    'visible_smoke.label': '¿Humo visible?',
    'visible_flame.label': '¿Llama visible?',
    'limitations.label': 'Limitaciones observadas',
    'notes.label': 'Notas operacionales',
  },
  compatibility: { offline_package_model_version: '1.0.0' },
  created_at: NOW,
  deprecated_at: null,
}

export const LOCATION_CONFIRMATION_SCHEMA: FieldFormSchemaRecord = {
  schema_id: 'location_confirmation',
  schema_version: '1.0.0',
  domain: FIRE_FIELD_FORM_DOMAIN,
  mission_type: 'field_visual_inspection',
  task_type: 'record_gps_position',
  evidence_type: 'location_confirmation',
  json_schema: {
    type: 'object',
    required: ['current_location', 'location_method', 'relation_to_target'],
    properties: {
      current_location: {
        type: 'object',
        required: ['lat', 'lng'],
        properties: {
          lat: { type: 'number' },
          lng: { type: 'number' },
          accuracy_m: { type: 'number', minimum: 0 },
        },
      },
      location_method: {
        type: 'string',
        enum: ['device_gps', 'manual_pin', 'estimated', 'unknown'],
      },
      relation_to_target: {
        type: 'string',
        enum: ['inside_area', 'near_area', 'outside_area', 'could_not_reach', 'unknown'],
      },
      access_blocked_reason: { type: 'string', maxLength: 500 },
    },
    additionalProperties: false,
  },
  ui_schema: {
    current_location: { 'ui:widget': 'coordinates' },
    location_method: { 'ui:widget': 'select' },
    relation_to_target: { 'ui:widget': 'select' },
    access_blocked_reason: { 'ui:widget': 'textarea', 'ui:rows': 3 },
  },
  conditional_rules: [
    {
      id: 'could-not-reach',
      when: { field: 'relation_to_target', equals: 'could_not_reach' },
      then: { require: ['access_blocked_reason'] },
    },
  ],
  validation_rules: {},
  localization: {
    'current_location.label': 'Ubicación actual',
    'location_method.label': 'Método de ubicación',
    'relation_to_target.label': 'Relación con área objetivo',
  },
  compatibility: { offline_package_model_version: '1.0.0' },
  created_at: NOW,
  deprecated_at: null,
}

export const FIELD_ACCESS_ASSESSMENT_SCHEMA: FieldFormSchemaRecord = {
  schema_id: 'field_access_assessment',
  schema_version: '1.0.0',
  domain: FIRE_FIELD_FORM_DOMAIN,
  mission_type: 'field_visual_inspection',
  task_type: 'navigate_to_area',
  evidence_type: null,
  json_schema: {
    type: 'object',
    required: ['access_possible', 'access_type'],
    properties: {
      access_possible: { type: 'string', enum: ['yes', 'no', 'partial', 'uncertain'] },
      access_type: {
        type: 'string',
        enum: ['foot', 'vehicle', 'boat', 'air', 'mixed', 'unknown'],
      },
      restrictions: { type: 'array', items: { type: 'string' } },
      observed_risks: { type: 'array', items: { type: 'string' } },
      alternative_point: {
        type: 'object',
        properties: { lat: { type: 'number' }, lng: { type: 'number' }, notes: { type: 'string' } },
      },
      notes: { type: 'string', maxLength: 1000 },
    },
    additionalProperties: false,
  },
  ui_schema: {
    access_possible: { 'ui:widget': 'yes_no_uncertain' },
    access_type: { 'ui:widget': 'select' },
    restrictions: { 'ui:widget': 'checklist' },
    observed_risks: { 'ui:widget': 'checklist' },
    alternative_point: { 'ui:widget': 'coordinates' },
    notes: { 'ui:widget': 'textarea' },
  },
  conditional_rules: [
    {
      id: 'no-access-alt',
      when: { field: 'access_possible', in: ['no', 'partial'] },
      then: { show: ['alternative_point', 'notes'], require: ['notes'] },
    },
  ],
  validation_rules: {},
  localization: {
    'access_possible.label': '¿Acceso posible?',
    'access_type.label': 'Tipo de acceso',
    'alternative_point.label': 'Punto alternativo',
  },
  compatibility: { offline_package_model_version: '1.0.0' },
  created_at: NOW,
  deprecated_at: null,
}

export const STRUCTURED_NEGATIVE_OBSERVATION_SCHEMA: FieldFormSchemaRecord = {
  schema_id: 'structured_negative_observation',
  schema_version: '1.0.0',
  domain: FIRE_FIELD_FORM_DOMAIN,
  mission_type: 'field_visual_inspection',
  task_type: 'record_visible_indicators',
  evidence_type: 'structured_observation',
  json_schema: {
    type: 'object',
    required: ['not_observed_items', 'observation_duration_minutes', 'observation_distance_m'],
    properties: {
      not_observed_items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'string',
          enum: ['smoke', 'flame', 'burned_area', 'active_heat', 'other'],
        },
      },
      observation_duration_minutes: { type: 'integer', minimum: 1, maximum: 480 },
      observation_distance_m: { type: 'number', minimum: 0 },
      visual_coverage: {
        type: 'string',
        enum: ['full', 'partial', 'limited', 'unknown'],
      },
      conditions: { type: 'string', maxLength: 500 },
      limitations: { type: 'string', maxLength: 1000 },
      notes: { type: 'string', maxLength: 1000 },
    },
    additionalProperties: false,
  },
  ui_schema: {
    not_observed_items: { 'ui:widget': 'checklist' },
    observation_duration_minutes: { 'ui:widget': 'integer' },
    observation_distance_m: { 'ui:widget': 'distance' },
    visual_coverage: { 'ui:widget': 'select' },
    limitations: { 'ui:widget': 'textarea' },
    notes: { 'ui:widget': 'textarea' },
  },
  conditional_rules: [
    {
      id: 'limited-coverage',
      when: { field: 'visual_coverage', in: ['partial', 'limited'] },
      then: { require: ['limitations'], set_status_hint: 'complete_with_limitations' },
    },
  ],
  validation_rules: {
    notes: { forbidden_pattern_ids: ['confirmed_fire_claim', 'extinction_claim'] },
  },
  localization: {
    'not_observed_items.label': 'Indicadores no observados',
    'observation_duration_minutes.label': 'Duración de observación (min)',
    'limitations.label': 'Limitaciones',
  },
  compatibility: { offline_package_model_version: '1.0.0' },
  created_at: NOW,
  deprecated_at: null,
}

export const FIRE_FIELD_FORM_SCHEMAS: FieldFormSchemaRecord[] = [
  FIELD_VISUAL_OBSERVATION_SCHEMA,
  LOCATION_CONFIRMATION_SCHEMA,
  FIELD_ACCESS_ASSESSMENT_SCHEMA,
  STRUCTURED_NEGATIVE_OBSERVATION_SCHEMA,
]

export const TASK_TYPE_SCHEMA_MAP: Record<string, string> = {
  navigate_to_area: 'field_access_assessment',
  record_gps_position: 'location_confirmation',
  structured_observation: 'field_visual_observation',
  record_visible_indicators: 'structured_negative_observation',
  capture_georeferenced_photos: 'field_visual_observation',
}

export const FORBIDDEN_ANSWER_PATTERN_IDS = {
  confirmed_fire_claim: ['incendio confirmado', 'fuego confirmado'],
  extinction_claim: ['extinción', 'extinguido', 'sin riesgo'],
} as const

export function schemaForTaskType(taskType: string): FieldFormSchemaRecord | null {
  const schemaId = TASK_TYPE_SCHEMA_MAP[taskType]
  if (!schemaId) return null
  return FIRE_FIELD_FORM_SCHEMAS.find((s) => s.schema_id === schemaId) ?? null
}

export function toPackageFormSchema(record: FieldFormSchemaRecord) {
  return {
    schema_id: record.schema_id,
    schema_version: record.schema_version,
    json_schema: record.json_schema,
    ui_schema: record.ui_schema,
    validation_rules: record.validation_rules,
    conditional_rules: record.conditional_rules,
    localization: record.localization,
  }
}

export const PACKAGE_EMBEDDED_FIRE_SCHEMAS = FIRE_FIELD_FORM_SCHEMAS.map(toPackageFormSchema)
