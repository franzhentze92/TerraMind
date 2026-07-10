export function incidentStatusLabel(status: string): string {
  const map: Record<string, string> = {
    open: 'Abierto',
    monitoring: 'Monitoreo',
    resolved: 'Resuelto',
    invalidated: 'Invalidado',
    merged: 'Fusionado',
    split: 'Separado',
  }
  return map[status] ?? status
}

export function incidentTypeLabel(type: string): string {
  if (type === 'possible_vegetation_fire_incident') {
    return 'Posible situación térmica relacionada'
  }
  return type
}

export function evidenceStatusLabel(status: string): string {
  const map: Record<string, string> = {
    single_source: 'Fuente única',
    multi_event_same_source: 'Varios eventos, misma fuente',
    multi_source: 'Múltiples fuentes',
    field_supported: 'Apoyado en campo',
    verified: 'Verificado',
  }
  return map[status] ?? status
}

export function incidentStatusVariant(
  status: string,
): 'default' | 'accent' | 'warning' | 'danger' {
  if (status === 'open') return 'warning'
  if (status === 'monitoring') return 'accent'
  if (status === 'resolved' || status === 'merged') return 'default'
  if (status === 'invalidated') return 'danger'
  return 'default'
}
