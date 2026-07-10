export function missionStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Borrador',
    ready: 'Lista',
    approved: 'Aprobada',
    in_progress: 'En progreso',
    blocked: 'Bloqueada',
    completed: 'Completada',
    inconclusive: 'Inconclusa',
    cancelled: 'Cancelada',
    expired: 'Expirada',
    failed: 'Fallida',
  }
  return map[status] ?? status
}

export function missionTypeLabel(type: string): string {
  const map: Record<string, string> = {
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
  return map[type] ?? type
}
