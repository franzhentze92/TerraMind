import { humanizeToken } from '@/shared/product-language'

export function missionStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Borrador',
    ready: 'Lista',
    approved: 'Aprobada',
    assigned: 'Asignada',
    in_progress: 'En progreso',
    blocked: 'Bloqueada',
    completed: 'Completada',
    inconclusive: 'Inconclusa',
    cancelled: 'Cancelada',
    expired: 'Expirada',
    failed: 'Fallida',
  }
  return map[status] ?? humanizeToken(status)
}

export function missionTypeLabel(type: string): string {
  const map: Record<string, string> = {
    field_verification: 'Verificación de campo',
    remote_analytical_review: 'Revisión analítica remota',
    satellite_reobservation_request: 'Reobservación satelital',
    higher_resolution_imagery_review: 'Imagen de mayor resolución',
    local_authority_confirmation_request: 'Confirmación institucional',
    protected_area_staff_observation: 'Observación de personal AP',
    structured_citizen_evidence_request: 'Reporte ciudadano estructurado',
    field_visual_inspection: 'Inspección visual de campo',
    georeferenced_photo_collection: 'Fotografía georreferenciada',
    drone_observation: 'Observación con dron',
  }
  return map[type] ?? humanizeToken(type)
}

export function missionAssignmentStatusLabel(status: string): string {
  const map: Record<string, string> = {
    proposed: 'Propuesta',
    assigned: 'Asignada',
    accepted: 'Aceptada',
    in_progress: 'En progreso',
    completed: 'Completada',
    declined: 'Rechazada',
    revoked: 'Revocada',
    blocked: 'Bloqueada',
    expired: 'Expirada',
    cancelled: 'Cancelada',
  }
  return map[status] ?? humanizeToken(status)
}

export function missionTaskStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pendiente',
    in_progress: 'En progreso',
    completed: 'Completada',
    skipped: 'Omitida',
    blocked: 'Bloqueada',
    failed: 'Fallida',
  }
  return map[status] ?? humanizeToken(status)
}

export function missionAssigneeTypeLabel(type: string): string {
  const map: Record<string, string> = {
    user: 'Usuario',
    team: 'Equipo',
    organization: 'Organización',
    field_unit: 'Unidad de campo',
    partner: 'Socio institucional',
  }
  return map[type] ?? humanizeToken(type)
}
