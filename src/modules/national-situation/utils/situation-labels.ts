import { humanizeToken } from '@/shared/product-language'

/**
 * Presentation layer for Situación Nacional. No raw internal value or English
 * token should reach the UI — everything routes through these helpers.
 */

/** Spanish label for a timeline entry's epistemic kind. */
export function epistemicLabel(kind: string): string {
  const map: Record<string, string> = {
    observed: 'Observado',
    inferred: 'Inferido',
    verified: 'Verificado',
    undetermined: 'Sin determinar',
    recommended: 'Recomendado',
    decided: 'Decidido',
    executed: 'Ejecutado',
  }
  return map[kind] ?? humanizeToken(kind)
}

/** Spanish label for a timeline stage token (fallback when the server label is missing). */
export function timelineStageLabel(stage: string): string {
  const map: Record<string, string> = {
    observation: 'Observación',
    event: 'Evento',
    finding: 'Hallazgo',
    priority: 'Prioridad',
    incident: 'Incidente',
    verification: 'Verificación',
    mission: 'Misión',
    evidence: 'Evidencia',
    resolution: 'Resolución',
    response: 'Respuesta',
    decision: 'Decisión',
    action: 'Acción',
  }
  return map[stage] ?? humanizeToken(stage)
}

/** Spanish descriptor for a record classification shown in situation surfaces. */
export function situationClassificationLabel(
  classification: 'operational' | 'legacy' | 'demo' | string,
): string {
  const map: Record<string, string> = {
    operational: 'Operacional',
    legacy: 'Registro histórico',
    demo: 'Demostración',
  }
  return map[classification] ?? humanizeToken(classification)
}

/** Spanish label for an evidence-submission status. */
export function evidenceSubmissionStatusLabel(status: string): string {
  const map: Record<string, string> = {
    submitted: 'Enviada',
    pending: 'Pendiente',
    pending_review: 'Pendiente de revisión',
    under_review: 'En revisión',
    accepted: 'Aceptada',
    accepted_with_limitations: 'Aceptada con limitaciones',
    inconclusive: 'Inconclusa',
    rejected: 'Rechazada',
  }
  return map[status] ?? humanizeToken(status)
}

/** Spanish label for a decision-record status. */
export function decisionStatusLabel(status: string): string {
  const map: Record<string, string> = {
    recommended: 'Recomendada',
    pending_approval: 'Pendiente de aprobación',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    executed: 'Ejecutada',
    cancelled: 'Cancelada',
  }
  return map[status] ?? humanizeToken(status)
}

export const HISTORICAL_PENDING_ORG_SUFFIX = 'pendientes de asignación organizacional'

export type SystemHealthTone = 'ok' | 'warning' | 'danger'

export interface SystemHealth {
  label: string
  tone: SystemHealthTone
}

/**
 * Resolve a single, honest health label from pipeline status + data freshness.
 * Never claims full health just because one process is recent.
 */
export function resolveSystemHealth(
  systemStatus: string | undefined,
  freshnessStatus: 'fresh' | 'delayed' | 'stale' | undefined,
): SystemHealth {
  if (freshnessStatus === 'stale') return { label: 'Datos retrasados', tone: 'warning' }
  if (systemStatus && systemStatus !== 'operational') {
    return { label: 'Sistema con incidencias', tone: 'danger' }
  }
  if (freshnessStatus === 'delayed') {
    return { label: 'Datos parcialmente actualizados', tone: 'warning' }
  }
  if (freshnessStatus === 'fresh') return { label: 'Todos los procesos actualizados', tone: 'ok' }
  return { label: 'Sistema disponible', tone: 'ok' }
}

/**
 * Specific, human reason for why a finding is prioritized, derived from its type.
 * Returns null when no specific reason is known (caller hides the line).
 */
export function findingTypeReason(findingType: string): string | null {
  const map: Record<string, string> = {
    thermal_activity_in_protected_area: 'Actividad térmica dentro de un área protegida.',
    thermal_activity_near_protected_area: 'Actividad térmica cerca de un área protegida.',
    thermal_activity_on_forest_cover: 'Actividad térmica sobre cobertura forestal.',
    thermal_activity_in_mixed_natural_cover: 'Actividad térmica próxima a cobertura natural.',
    dry_conditions_around_thermal_event: 'Condiciones secas en el entorno del evento.',
    strong_wind_during_thermal_event: 'Viento fuerte durante la detección térmica.',
    nearby_population_with_reliable_estimate: 'Población modelada en el área inmediata.',
    nearby_population_with_high_uncertainty:
      'Posible población cercana con estimación incierta.',
    documented_biodiversity_near_event: 'Biodiversidad documentada en el entorno.',
    biodiversity_context_limited: 'Contexto de biodiversidad relevante.',
    multi_context_attention: 'Varios contextos coinciden y requieren atención conjunta.',
  }
  return map[findingType] ?? null
}

const NUMBER_WORDS = [
  'cero',
  'un',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
]

/** Spell out small counts for executive prose; larger numbers fall back to digits. */
export function spellCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return String(n)
  return NUMBER_WORDS[n] ?? String(n)
}

/** Natural language for the selected period window (used in "Qué cambió"). */
export function periodWindowPhrase(periodHours: number): string {
  if (periodHours <= 24) return 'las últimas 24 horas'
  if (periodHours <= 48) return 'las últimas 48 horas'
  if (periodHours <= 168) return 'los últimos 7 días'
  return 'los últimos 30 días'
}
