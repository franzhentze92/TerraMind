import type { MissionPermission } from '@/modules/missions/assignment/assignment.types'

export const MISSION_WORKFLOW_VERSION = '1.0.0'

export const MISSION_TYPE_REQUIRED_CAPABILITIES: Record<string, string[]> = {
  remote_analytical_review: ['remote_analysis', 'satellite_review'],
  satellite_reobservation_request: ['satellite_review'],
  higher_resolution_imagery_review: ['satellite_review'],
  local_authority_confirmation_request: ['institutional_coordination'],
  protected_area_staff_observation: ['institutional_coordination', 'field_inspection'],
  structured_citizen_evidence_request: ['institutional_coordination'],
  field_visual_inspection: ['field_inspection'],
  georeferenced_photo_collection: ['field_inspection', 'georeferenced_photography'],
  drone_observation: ['drone_operation', 'field_inspection'],
}

export const METHOD_REQUIRED_CAPABILITIES: Record<string, string[]> = {
  field_visual_inspection: ['field_inspection'],
  georeferenced_photo_collection: ['georeferenced_photography'],
  drone_observation: ['drone_operation'],
  review_latest_thermal_detections: ['remote_analysis'],
  review_time_series: ['remote_analysis'],
  request_local_authority_confirmation: ['institutional_coordination'],
}

export const ALL_MISSION_PERMISSIONS: MissionPermission[] = [
  'missions.assign',
  'missions.accept',
  'missions.decline',
  'missions.reassign',
  'missions.start',
  'missions.block',
  'missions.complete',
  'missions.cancel',
  'missions.override_compatibility',
]

export const ACTION_REQUIRED_PERMISSION: Record<string, MissionPermission> = {
  assign: 'missions.assign',
  accept: 'missions.accept',
  decline: 'missions.decline',
  reassign: 'missions.reassign',
  start: 'missions.start',
  block: 'missions.block',
  resume: 'missions.start',
  complete: 'missions.complete',
  cancel: 'missions.cancel',
}

/** Fixtures sintéticos — solo para pruebas, no se insertan en producción */
export const SYNTHETIC_ASSIGNEES = {
  field_inspector: {
    id: 'fixture-field-inspector',
    assignee_type: 'user' as const,
    display_name: 'Inspector de campo (fixture)',
    organization_id: 'org-conap',
    coverage_zones: ['guatemala'],
    capabilities: ['field_inspection', 'georeferenced_photography'],
    allowed_mission_types: ['field_visual_inspection', 'georeferenced_photo_collection'],
    max_active_missions: 3,
    is_available: true,
    is_active: true,
    permissions: ALL_MISSION_PERMISSIONS,
  },
  remote_analyst: {
    id: 'fixture-remote-analyst',
    assignee_type: 'user' as const,
    display_name: 'Analista remoto (fixture)',
    organization_id: 'org-terramind',
    coverage_zones: ['national'],
    capabilities: ['remote_analysis', 'satellite_review'],
    allowed_mission_types: ['remote_analytical_review', 'satellite_reobservation_request'],
    max_active_missions: 5,
    is_available: true,
    is_active: true,
    permissions: ALL_MISSION_PERMISSIONS,
  },
  incompatible_actor: {
    id: 'fixture-incompatible',
    assignee_type: 'external_actor' as const,
    display_name: 'Actor incompatible (fixture)',
    organization_id: null,
    coverage_zones: [],
    capabilities: ['institutional_coordination'],
    allowed_mission_types: [],
    max_active_missions: 1,
    is_available: true,
    is_active: true,
    permissions: ['missions.accept'] as MissionPermission[],
  },
  overloaded_actor: {
    id: 'fixture-overloaded',
    assignee_type: 'user' as const,
    display_name: 'Ejecutor saturado (fixture)',
    organization_id: 'org-conap',
    coverage_zones: ['guatemala'],
    capabilities: ['field_inspection'],
    allowed_mission_types: ['field_visual_inspection'],
    max_active_missions: 0,
    is_available: true,
    is_active: true,
    permissions: ALL_MISSION_PERMISSIONS,
  },
}
