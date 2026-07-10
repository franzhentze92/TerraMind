import { evaluateReconciliation } from '@/modules/field-operations/field-sync/engine/field-sync-reconciliation'
import { FIRE_FIELD_SYNC_MODEL_VERSION } from '@/modules/field-operations/field-sync/config/fire-field-sync.config'

const sample = evaluateReconciliation({
  bundle_id: 'sample',
  bundle_checksum: 'sample-checksum',
  expected_record_count: 1,
  submissions: [
    {
      submission_id: 'sub-sample',
      status: 'ready_for_validation',
      evidence_type: 'structured_observation',
      assets: [],
      has_observation: true,
      requirement_link_count: 1,
    },
  ],
})

console.log(
  JSON.stringify(
    {
      model_version: FIRE_FIELD_SYNC_MODEL_VERSION,
      sample_reconciliation_ok: sample.ok,
      reconciliation_checksum: sample.reconciliation_checksum,
      valid: sample.reconciliation_checksum.length === 64,
      generated_at: new Date().toISOString(),
    },
    null,
    2,
  ),
)

process.exit(sample.ok && sample.reconciliation_checksum.length === 64 ? 0 : 1)
