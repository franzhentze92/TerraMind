import type { ConditionalRule, ConditionalWhen } from '@/modules/field-operations/field-forms/field-form.types'

export function evaluateWhen(when: ConditionalWhen, answers: Record<string, unknown>): boolean {
  const value = answers[when.field]
  if (when.exists !== undefined) {
    const exists = value !== undefined && value !== null && value !== ''
    return when.exists ? exists : !exists
  }
  if (when.equals !== undefined) return value === when.equals
  if (when.not_equals !== undefined) return value !== when.not_equals
  if (when.in !== undefined) return when.in.includes(value)
  return false
}

export function applyConditionalRules(
  rules: ConditionalRule[],
  answers: Record<string, unknown>,
  baseVisible: string[],
  baseRequired: string[],
): {
  visible_fields: string[]
  required_fields: string[]
  warning_fields: string[]
  status_hint: 'complete_with_limitations' | null
} {
  const visible = new Set(baseVisible)
  const required = new Set(baseRequired)
  const warnings = new Set<string>()
  let statusHint: 'complete_with_limitations' | null = null

  for (const rule of rules) {
    if (!evaluateWhen(rule.when, answers)) continue
    for (const field of rule.then.show ?? []) visible.add(field)
    for (const field of rule.then.hide ?? []) visible.delete(field)
    for (const field of rule.then.require ?? []) required.add(field)
    for (const field of rule.then.warn ?? []) warnings.add(field)
    if (rule.then.set_status_hint === 'complete_with_limitations') {
      statusHint = 'complete_with_limitations'
    }
  }

  return {
    visible_fields: [...visible].sort(),
    required_fields: [...required].sort(),
    warning_fields: [...warnings].sort(),
    status_hint: statusHint,
  }
}

export function defaultVisibleFields(jsonSchema: Record<string, unknown>): string[] {
  const props = jsonSchema.properties as Record<string, unknown> | undefined
  if (!props) return []
  return Object.keys(props).sort()
}
