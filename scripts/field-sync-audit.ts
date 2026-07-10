import { FIRE_FIELD_SYNC_MODEL_VERSION } from '@/modules/field-operations/field-sync/config/fire-field-sync.config'

console.log(
  JSON.stringify(
    {
      model_version: FIRE_FIELD_SYNC_MODEL_VERSION,
      sync_statuses: [
        'pending_sync',
        'sync_queued',
        'syncing',
        'partially_synced',
        'sync_blocked',
        'conflict',
        'synced',
        'remote_rejected',
        'retry_scheduled',
        'cancelled',
      ],
      generated_at: new Date().toISOString(),
    },
    null,
    2,
  ),
)
