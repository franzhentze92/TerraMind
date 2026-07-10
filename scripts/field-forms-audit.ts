import { FIRE_FIELD_FORM_MODEL_VERSION, FIRE_FIELD_FORM_SCHEMAS } from '@/modules/field-operations/field-forms/config/fire-field-form.config'

console.log(
  JSON.stringify(
    {
      model_version: FIRE_FIELD_FORM_MODEL_VERSION,
      schema_count: FIRE_FIELD_FORM_SCHEMAS.length,
      schemas: FIRE_FIELD_FORM_SCHEMAS.map((s) => ({
        schema_id: s.schema_id,
        schema_version: s.schema_version,
        task_type: s.task_type,
        conditional_rules: s.conditional_rules.length,
        deprecated_at: s.deprecated_at,
      })),
      generated_at: new Date().toISOString(),
    },
    null,
    2,
  ),
)
