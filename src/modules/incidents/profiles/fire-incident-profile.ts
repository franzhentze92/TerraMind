import {
  FIRE_INCIDENT_CORRELATION_MODEL_VERSION,
  FIRE_INCIDENT_DOMAIN,
  FIRE_INCIDENT_TYPE,
} from '@/modules/incidents/config/fire-incident-correlation.config'

export const fireIncidentProfile = {
  entity_type: 'fire_event' as const,
  incident_type: FIRE_INCIDENT_TYPE,
  domain: FIRE_INCIDENT_DOMAIN,
  correlation_model_version: FIRE_INCIDENT_CORRELATION_MODEL_VERSION,
}
