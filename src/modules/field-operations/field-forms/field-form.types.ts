export const FIELD_FORM_MODEL_VERSION = '1.0.0'

export const FIELD_FORM_RESPONSE_STATUSES = [
  'not_started',
  'draft',
  'invalid',
  'complete',
  'complete_with_limitations',
  'locked',
  'superseded',
  'abandoned',
] as const

export type FieldFormResponseStatus = (typeof FIELD_FORM_RESPONSE_STATUSES)[number]

export const FIELD_WIDGET_TYPES = [
  'text',
  'textarea',
  'integer',
  'number',
  'boolean',
  'yes_no_uncertain',
  'select',
  'multiselect',
  'date',
  'datetime',
  'time',
  'coordinates',
  'distance',
  'area',
  'percentage',
  'unit_value',
  'note',
  'checklist',
  'repeatable_group',
  'read_only_context',
] as const

export type FieldWidgetType = (typeof FIELD_WIDGET_TYPES)[number]

export interface FieldFormSchemaRecord {
  schema_id: string
  schema_version: string
  domain: string
  mission_type: string | null
  task_type: string | null
  evidence_type: string | null
  json_schema: Record<string, unknown>
  ui_schema: Record<string, unknown>
  conditional_rules: ConditionalRule[]
  validation_rules: Record<string, unknown>
  localization: Record<string, string>
  compatibility: {
    min_package_model_version?: string
    offline_package_model_version?: string
  }
  created_at: string
  deprecated_at: string | null
}

export interface ConditionalRule {
  id: string
  when: ConditionalWhen
  then: ConditionalThen
}

export interface ConditionalWhen {
  field: string
  equals?: unknown
  in?: unknown[]
  not_equals?: unknown
  exists?: boolean
}

export interface ConditionalThen {
  show?: string[]
  hide?: string[]
  require?: string[]
  warn?: string[]
  set_status_hint?: 'complete_with_limitations'
}

export interface ValidationMessage {
  field: string
  code: string
  message: string
  level: 'error' | 'warning' | 'info'
}

export interface FieldFormValidationResult {
  valid: boolean
  can_complete: boolean
  can_complete_with_limitations: boolean
  errors: ValidationMessage[]
  warnings: ValidationMessage[]
  info: ValidationMessage[]
  visible_fields: string[]
  required_fields: string[]
}

export interface FieldFormResponseRecord {
  response_id: string
  package_id: string
  package_version: number
  mission_id: string
  task_id: string
  requirement_id: string | null
  verification_need_id: string | null
  schema_id: string
  schema_version: string
  status: FieldFormResponseStatus
  answers: Record<string, unknown>
  validation_errors: ValidationMessage[]
  limitations: string[]
  created_at: string
  updated_at: string
  completed_at: string | null
  local_revision: number
  context_signature: string
  supersedes_response_id: string | null
  revision_reason: string | null
  last_saved_at: string | null
  tab_id: string | null
}

export interface FieldFormRevisionSnapshot {
  revision_id: string
  response_id: string
  local_revision: number
  status: FieldFormResponseStatus
  answers: Record<string, unknown>
  limitations: string[]
  checksum: string
  created_at: string
  reason: string | null
}

export interface FieldFormOutputPayload {
  response_id: string
  mission_id: string
  task_id: string
  requirement_id: string | null
  schema_id: string
  schema_version: string
  status: FieldFormResponseStatus
  answers: Record<string, unknown>
  limitations: string[]
  captured_at: string
  device_location: Record<string, unknown>
  package_version: number
  package_id: string
  checksum: string
}

export interface TaskFormBinding {
  task_id: string
  task_type: string
  schema_id: string
  requirement_id: string | null
  verification_need_id: string | null
}

export interface LocalTaskProgress {
  task_id: string
  status: 'not_started' | 'draft' | 'complete' | 'complete_with_limitations' | 'blocked'
  response_id: string | null
  schema_id: string | null
}

export type FieldFormLocale = 'es' | 'en'
