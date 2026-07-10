import {
  FORBIDDEN_ANSWER_PATTERN_IDS,
  FIRE_FIELD_FORM_SCHEMAS,
} from '@/modules/field-operations/field-forms/config/fire-field-form.config'
import { scanAnswersForForbiddenCopy } from '@/modules/field-operations/field-forms/field-form-copy-guard'
import {
  applyConditionalRules,
  defaultVisibleFields,
} from '@/modules/field-operations/field-forms/engine/conditional-engine'
import type {
  FieldFormSchemaRecord,
  FieldFormValidationResult,
  ValidationMessage,
} from '@/modules/field-operations/field-forms/field-form.types'

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

function schemaProperty(schema: Record<string, unknown>, field: string): Record<string, unknown> | null {
  const props = schema.properties as Record<string, Record<string, unknown>> | undefined
  return props?.[field] ?? null
}

function validateType(field: string, def: Record<string, unknown>, value: unknown): ValidationMessage | null {
  if (isEmpty(value)) return null
  const type = def.type as string | undefined
  if (type === 'string' && typeof value !== 'string') {
    return { field, code: 'type_mismatch', message: 'Debe ser texto', level: 'error' }
  }
  if (type === 'integer' && (!Number.isInteger(value) || typeof value === 'boolean')) {
    return { field, code: 'type_mismatch', message: 'Debe ser entero', level: 'error' }
  }
  if (type === 'number' && typeof value !== 'number') {
    return { field, code: 'type_mismatch', message: 'Debe ser numérico', level: 'error' }
  }
  if (type === 'array' && !Array.isArray(value)) {
    return { field, code: 'type_mismatch', message: 'Debe ser lista', level: 'error' }
  }
  if (type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
    return { field, code: 'type_mismatch', message: 'Debe ser objeto', level: 'error' }
  }
  if (def.enum && !((def.enum as unknown[]).includes(value))) {
    return { field, code: 'invalid_enum', message: 'Valor no permitido', level: 'error' }
  }
  if (typeof value === 'string' && def.maxLength && value.length > Number(def.maxLength)) {
    return { field, code: 'max_length', message: 'Texto demasiado largo', level: 'error' }
  }
  if (typeof value === 'number' && def.minimum !== undefined && value < Number(def.minimum)) {
    return { field, code: 'min_value', message: 'Valor por debajo del mínimo', level: 'error' }
  }
  return null
}

function checkForbiddenPatterns(
  field: string,
  value: unknown,
  validationRules: Record<string, unknown>,
): ValidationMessage | null {
  const rules = validationRules[field] as { forbidden_pattern_ids?: string[] } | undefined
  if (!rules?.forbidden_pattern_ids || typeof value !== 'string') return null
  for (const id of rules.forbidden_pattern_ids) {
    const patterns = FORBIDDEN_ANSWER_PATTERN_IDS[id as keyof typeof FORBIDDEN_ANSWER_PATTERN_IDS]
    if (!patterns) continue
    const lower = value.toLowerCase()
    for (const p of patterns) {
      if (lower.includes(p)) {
        return { field, code: 'forbidden_copy', message: 'Lenguaje no permitido', level: 'error' }
      }
    }
  }
  return null
}

export function validateFieldFormAnswers(
  schema: FieldFormSchemaRecord,
  answers: Record<string, unknown>,
  options: { finalize?: boolean } = {},
): FieldFormValidationResult {
  const jsonSchema = schema.json_schema
  const baseVisible = defaultVisibleFields(jsonSchema)
  const baseRequired = (jsonSchema.required as string[] | undefined) ?? []
  const conditional = applyConditionalRules(
    schema.conditional_rules,
    answers,
    baseVisible,
    baseRequired,
  )

  const errors: ValidationMessage[] = []
  const warnings: ValidationMessage[] = []
  const info: ValidationMessage[] = []

  for (const field of conditional.visible_fields) {
    const def = schemaProperty(jsonSchema, field)
    if (!def) continue
    const value = answers[field]
    const typeErr = validateType(field, def, value)
    if (typeErr) errors.push(typeErr)

    const forbidden = checkForbiddenPatterns(field, value, schema.validation_rules)
    if (forbidden) errors.push(forbidden)

    if (options.finalize && conditional.required_fields.includes(field) && isEmpty(value)) {
      errors.push({ field, code: 'required', message: 'Campo obligatorio', level: 'error' })
    }

    if (field === 'device_location' || field === 'current_location') {
      const loc = value as { accuracy_m?: number } | undefined
      const minAcc = (schema.validation_rules.device_location as { min_accuracy_m_informative?: number })
        ?.min_accuracy_m_informative
      if (loc?.accuracy_m !== undefined && minAcc && loc.accuracy_m > minAcc) {
        warnings.push({
          field,
          code: 'gps_accuracy_low',
          message: 'Precisión GPS informativa limitada',
          level: 'warning',
        })
      }
    }
  }

  for (const field of conditional.warning_fields) {
    if (field === 'photo_required_later') {
      warnings.push({
        field: 'visible_smoke',
        code: 'photo_required_later',
        message: 'Se requerirá evidencia fotográfica en fase posterior',
        level: 'warning',
      })
    }
  }

  const copyViolations = scanAnswersForForbiddenCopy(answers)
  for (const v of copyViolations) {
    errors.push({ field: v.split(':')[0], code: 'forbidden_copy', message: v, level: 'error' })
  }

  if (conditional.status_hint === 'complete_with_limitations' && options.finalize) {
    warnings.push({
      field: '_form',
      code: 'complete_with_limitations_hint',
      message: 'El formulario puede finalizarse con limitaciones',
      level: 'warning',
    })
  }

  const valid = errors.length === 0
  const can_complete = valid && (!conditional.status_hint || warnings.length === 0)
  const can_complete_with_limitations =
    valid && (warnings.length > 0 || conditional.status_hint === 'complete_with_limitations')

  return {
    valid,
    can_complete,
    can_complete_with_limitations,
    errors,
    warnings,
    info,
    visible_fields: conditional.visible_fields,
    required_fields: conditional.required_fields,
  }
}

export function validateAllFireSchemas(): Array<{ schema_id: string; ok: boolean; error?: string }> {
  return FIRE_FIELD_FORM_SCHEMAS.map((schema) => {
    try {
      if (!schema.schema_id || !schema.schema_version) throw new Error('missing identity')
      if (!schema.json_schema.properties) throw new Error('missing properties')
      return { schema_id: schema.schema_id, ok: true }
    } catch (err) {
      return {
        schema_id: schema.schema_id,
        ok: false,
        error: err instanceof Error ? err.message : 'invalid',
      }
    }
  })
}
