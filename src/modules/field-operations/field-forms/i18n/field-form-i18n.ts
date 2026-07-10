import type { FieldFormLocale } from '@/modules/field-operations/field-forms/field-form.types'

const EN: Record<string, string> = {
  'observation_datetime.label': 'Observation date and time',
  'visibility_conditions.label': 'Visibility conditions',
  'access_possible.label': 'Access possible?',
  'visible_smoke.label': 'Visible smoke?',
  'visible_flame.label': 'Visible flame?',
  'limitations.label': 'Observed limitations',
  'notes.label': 'Operational notes',
  'current_location.label': 'Current location',
  'location_method.label': 'Location method',
  'relation_to_target.label': 'Relation to target area',
  'access_type.label': 'Access type',
  'alternative_point.label': 'Alternative point',
  'not_observed_items.label': 'Indicators not observed',
  'observation_duration_minutes.label': 'Observation duration (min)',
  'save_draft': 'Save draft',
  'finalize': 'Finalize',
  'create_revision': 'Create revision',
  'last_saved': 'Last saved',
  'errors': 'Errors',
  'warnings': 'Warnings',
}

export function translateFieldLabel(
  key: string,
  schemaLocalization: Record<string, string>,
  locale: FieldFormLocale,
): string {
  if (locale === 'en') return EN[key] ?? schemaLocalization[key] ?? key
  return schemaLocalization[key] ?? EN[key] ?? key
}

export function translateUi(key: string, locale: FieldFormLocale): string {
  if (locale === 'en') return EN[key] ?? key
  const ES: Record<string, string> = {
    save_draft: 'Guardar borrador',
    finalize: 'Finalizar',
    create_revision: 'Crear revisión',
    last_saved: 'Último guardado',
    errors: 'Errores',
    warnings: 'Advertencias',
  }
  return ES[key] ?? key
}
