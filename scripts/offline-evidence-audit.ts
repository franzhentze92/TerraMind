import { FIRE_OFFLINE_EVIDENCE_MODEL_VERSION, SCHEMA_TO_EVIDENCE_TYPE } from '@/modules/field-operations/offline-evidence/config/fire-offline-evidence.config'

console.log(
  JSON.stringify(
    {
      model_version: FIRE_OFFLINE_EVIDENCE_MODEL_VERSION,
      schema_mappings: SCHEMA_TO_EVIDENCE_TYPE,
      evidence_types: Object.values(SCHEMA_TO_EVIDENCE_TYPE),
      generated_at: new Date().toISOString(),
    },
    null,
    2,
  ),
)
