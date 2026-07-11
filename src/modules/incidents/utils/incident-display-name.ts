/**
 * Deterministic, non-alarmist incident display names — Phase 2 §8.
 * Same helper for listados, detalle, historia, reportes and breadcrumbs.
 */
import { productLabel } from '@/shared/product-language'

export interface IncidentDisplayNameInput {
  incident_type?: string | null
  status?: string | null
  event_count?: number
  active_event_count?: number
  department_name?: string | null
  lifecycle_state?: string | null
  protected_area_context?: string | null
}

function lifecycleAdjective(state: string | null | undefined): string {
  if (!state) return 'reciente'
  const key = state.toLowerCase()
  if (key.includes('persistent') || key === 'lifecycle_persistent') return 'persistente'
  if (key.includes('expanding') || key === 'lifecycle_expanding') return 'en expansión'
  if (key.includes('declining') || key === 'lifecycle_declining') return 'en descenso'
  if (key === 'resolved' || key === 'inactive_monitoring') return 'reciente'
  return productLabel(key) !== key ? productLabel(key) : 'reciente'
}

function eventTypePhrase(incidentType: string | null | undefined): string {
  const t = (incidentType ?? '').toLowerCase()
  if (t.includes('vegetation') || t.includes('fire') || t.includes('thermal')) {
    return 'Actividad térmica'
  }
  return 'Situación operacional'
}

function locationPhrase(input: IncidentDisplayNameInput): string | null {
  if (input.protected_area_context) {
    return `próxima a área protegida en ${input.protected_area_context}`
  }
  const dept = input.department_name?.trim()
  if (dept) return `en ${dept}`
  return null
}

/**
 * Builds a human-readable incident title. Never declares "incendio" or invents
 * a department when location is unknown.
 */
export function buildIncidentDisplayName(input: IncidentDisplayNameInput): string {
  const phrase = eventTypePhrase(input.incident_type)
  const lifecycle = lifecycleAdjective(input.lifecycle_state)
  const location = locationPhrase(input)
  const events = input.event_count ?? 1

  if (events <= 1 && lifecycle === 'reciente' && !location) {
    return `${phrase} aislada`
  }

  if (!location) {
    return `${phrase} con ubicación pendiente`
  }

  if (lifecycle === 'persistente') {
    return `${phrase} persistente ${location}`
  }

  if (lifecycle === 'en expansión') {
    return `${phrase} en expansión ${location}`
  }

  if (lifecycle === 'en descenso') {
    return `${phrase} en descenso ${location}`
  }

  return `${phrase} ${lifecycle} ${location}`
}

/** Short label for breadcrumbs (max ~48 chars). */
export function buildIncidentBreadcrumbLabel(input: IncidentDisplayNameInput): string {
  const full = buildIncidentDisplayName(input)
  if (full.length <= 48) return full
  const location = locationPhrase(input)
  if (location) {
    const short = `${eventTypePhrase(input.incident_type)} ${location}`
    if (short.length <= 48) return short
  }
  return full.slice(0, 45) + '…'
}
