import {
  FIRE_PRIORITY_FINDINGS_RULE_SET,
  FIRE_PRIORITY_MODEL_VERSION,
} from '@/modules/priorities/config/fire-priority.config'

export const firePriorityProfile = {
  entity_type: 'fire_event',
  priority_model_version: FIRE_PRIORITY_MODEL_VERSION,
  findings_rule_set_version: FIRE_PRIORITY_FINDINGS_RULE_SET,
  required_inputs: ['active_findings', 'fire_event_metadata'],
  optional_inputs: ['context_availability'],
}
