import { FIRE_LIFECYCLE_MODEL_VERSION } from '@/modules/lifecycle/config/fire-lifecycle.config'

export const fireLifecycleProfile = {
  entity_type: 'fire_event' as const,
  lifecycle_model_version: FIRE_LIFECYCLE_MODEL_VERSION,
  initial_state: 'detected' as const,
}
