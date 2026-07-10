export function verificationPlanStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Borrador',
    ready: 'Listo',
    not_required: 'No requerido',
    blocked: 'Bloqueado',
    superseded: 'Reemplazado',
    satisfied: 'Satisfecho',
    cancelled: 'Cancelado',
  }
  return map[status] ?? status
}

export function verificationNeedTypeLabel(needType: string): string {
  const map: Record<string, string> = {
    confirm_recent_activity: 'Confirmar actividad reciente',
    assess_event_persistence: 'Evaluar persistencia',
    assess_spatial_extent: 'Evaluar extensión territorial',
    obtain_visual_ground_evidence: 'Obtener evidencia visual',
    clarify_land_cover_context: 'Completar cobertura del suelo',
    clarify_protected_area_relationship: 'Clarificar área protegida',
    improve_population_context: 'Mejorar contexto poblacional',
    differentiate_possible_non_fire_heat_source: 'Distinguir fuente térmica alternativa',
    verify_incident_resolution: 'Verificar cierre operacional',
    verify_reactivation: 'Verificar reactivación',
  }
  return map[needType] ?? needType
}

export function verificationMethodLabel(methodId: string): string {
  const map: Record<string, string> = {
    review_latest_thermal_detections: 'Revisión de detecciones térmicas',
    review_time_series: 'Revisión de serie temporal',
    request_new_satellite_observation: 'Nueva observación satelital',
    request_higher_resolution_imagery: 'Imagen de mayor resolución',
    review_land_cover_sources: 'Revisar cobertura del suelo',
    review_protected_area_geometry: 'Revisar áreas protegidas',
    review_population_model: 'Revisar modelo poblacional',
    cross_check_known_heat_sources: 'Cruzar fuentes térmicas conocidas',
    request_local_authority_confirmation: 'Confirmación institucional',
    request_protected_area_staff_observation: 'Observación de personal AP',
    request_structured_citizen_report: 'Reporte ciudadano estructurado',
    field_visual_inspection: 'Inspección visual de campo',
    georeferenced_photo_collection: 'Fotografía georreferenciada',
    drone_observation: 'Observación con dron',
  }
  return map[methodId] ?? methodId
}
