import { humanizeToken } from '@/shared/product-language'

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
  const map: Record<string, string> = {
    possible_vegetation_fire_incident: 'Posible situación térmica relacionada',
    vegetation_fire_incident: 'Actividad térmica',
    thermal_incident: 'Actividad térmica',
    fire: 'Actividad térmica',
  }
  if (map[type]) return map[type]
  const t = type.toLowerCase()
  if (t.includes('fire') || t.includes('thermal') || t.includes('vegetation')) {
    return 'Actividad térmica'
  }
  return humanizeToken(type)
}

/** Human-readable label for incident membership-history actions. */
export function incidentHistoryActionLabel(action: string): string {
  const map: Record<string, string> = {
    joined: 'Incorporado al incidente',
    left: 'Retirado del incidente',
    role_changed: 'Cambio de rol',
    primary_changed: 'Cambio de evento principal',
    created: 'Incidente creado',
    merged: 'Incidente fusionado',
    split: 'Incidente separado',
    resolved: 'Incidente resuelto',
  }
  return map[action] ?? humanizeToken(action)
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
