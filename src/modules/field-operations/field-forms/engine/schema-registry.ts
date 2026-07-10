import { FIRE_FIELD_FORM_MODEL_VERSION } from '@/modules/field-operations/field-forms/config/fire-field-form.config'
import type { FieldFormSchemaRecord } from '@/modules/field-operations/field-forms/field-form.types'
import type { OfflineFormSchema } from '@/modules/field-operations/offline-packages/offline-package.types'

export class FieldFormSchemaRegistry {
  private schemas = new Map<string, FieldFormSchemaRecord>()

  static schemaKey(schemaId: string, schemaVersion: string): string {
    return `${schemaId}@${schemaVersion}`
  }

  register(schema: FieldFormSchemaRecord): void {
    this.schemas.set(FieldFormSchemaRegistry.schemaKey(schema.schema_id, schema.schema_version), schema)
  }

  registerMany(schemas: FieldFormSchemaRecord[]): void {
    for (const s of schemas) this.register(s)
  }

  loadFromPackageForms(forms: OfflineFormSchema[]): void {
    for (const form of forms) {
      this.register({
        schema_id: form.schema_id,
        schema_version: form.schema_version,
        domain: 'fire',
        mission_type: null,
        task_type: null,
        evidence_type: null,
        json_schema: form.json_schema,
        ui_schema: form.ui_schema,
        conditional_rules: (form.conditional_rules as FieldFormSchemaRecord['conditional_rules']) ?? [],
        validation_rules: form.validation_rules,
        localization: form.localization,
        compatibility: { offline_package_model_version: '1.0.0' },
        created_at: new Date().toISOString(),
        deprecated_at: null,
      })
    }
  }

  get(schemaId: string, schemaVersion: string): FieldFormSchemaRecord | null {
    return this.schemas.get(FieldFormSchemaRegistry.schemaKey(schemaId, schemaVersion)) ?? null
  }

  getLatest(schemaId: string): FieldFormSchemaRecord | null {
    const matches = [...this.schemas.values()].filter((s) => s.schema_id === schemaId && !s.deprecated_at)
    return matches.sort((a, b) => b.schema_version.localeCompare(a.schema_version))[0] ?? null
  }

  list(): FieldFormSchemaRecord[] {
    return [...this.schemas.values()].sort((a, b) => a.schema_id.localeCompare(b.schema_id))
  }

  isCompatible(
    schema: FieldFormSchemaRecord,
    packageModelVersion: string,
  ): { compatible: boolean; reason?: string } {
    const required = schema.compatibility.offline_package_model_version
    if (required && required !== packageModelVersion) {
      return { compatible: false, reason: 'package_model_version_mismatch' }
    }
    if (schema.deprecated_at) return { compatible: false, reason: 'schema_deprecated' }
    return { compatible: true }
  }
}

export function createRegistryFromPackage(input: {
  embeddedForms: OfflineFormSchema[]
  builtinSchemas?: FieldFormSchemaRecord[]
}): FieldFormSchemaRegistry {
  const registry = new FieldFormSchemaRegistry()
  if (input.builtinSchemas) registry.registerMany(input.builtinSchemas)
  registry.loadFromPackageForms(input.embeddedForms)
  return registry
}

export function registryModelVersion(): string {
  return FIRE_FIELD_FORM_MODEL_VERSION
}
