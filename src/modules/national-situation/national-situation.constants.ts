import type { ExecutiveMetric } from '@/modules/executive-metrics/executive-metric.types'
import { getMetricRegistryEntry } from '@/modules/executive-metrics/metric-registry'
import { pluralizeCount } from '@/shared/format/plural'
import { HISTORICAL_PENDING_ORG_SUFFIX } from './utils/situation-labels'
import { ACTIVE_MISSION_STATUSES } from './utils/operational-period-comparison'

/**
 * Maximum primary KPIs visible in the executive overview.
 *
 * TerraMind's visible model (ministra-facing) is:
 *   Observaciones · Eventos · Amenazas · Misiones · Respuestas · Decisiones
 * i.e. Detectamos → interpretamos → asignamos → respondemos. The per-type
 * breakdown ("Por tipo de evento") is a separate card, not one of these six.
 */
export const PRIMARY_KPI_LIMIT = 6

/**
 * Canonical metric ids that are backed by a real ExecutiveMetric and appear in
 * the visible KPI row. Only observations is metric-backed today; every other
 * primary KPI is a synthetic slot fed by a dedicated canonical source (registry
 * for events, operational comparison for missions/decisions, etc.).
 *
 * `findings_active` and `incidents_operational` are intentionally NO LONGER
 * primary KPIs: findings become evidence inside a threat and incidents become an
 * internal operational state. Their metrics still exist for operational views.
 */
export const PRIMARY_KPI_METRIC_IDS = ['fire_observations'] as const

export type PrimaryKpiMetricId = (typeof PRIMARY_KPI_METRIC_IDS)[number]

/** Synthetic slot: cross-type active events count (from the event registry). */
export const EVENTS_ACTIVE_METRIC_ID = 'events_active'
export const EVENTS_ACTIVE_LABEL = 'Eventos activos'

/**
 * Synthetic slot for the executive threat count. Until the Canonical Threat
 * Engine exists this KPI is intentionally UNAVAILABLE — we never substitute the
 * number of findings, priorities, severe events or incidents for it.
 */
export const PRIORITY_THREATS_METRIC_ID = 'priority_threats'
export const PRIORITY_THREATS_LABEL = 'Amenazas prioritarias'
export const PRIORITY_THREATS_PENDING_SUBTITLE = 'Motor de amenazas pendiente'
export const PRIORITY_THREATS_PENDING_EXPLANATION =
  'Las amenazas prioritarias se calcularán a partir de uno o varios eventos, evidencia, impacto y prioridad ejecutiva.'

/** Synthetic slot: missions currently assigned or in execution. */
export const ACTIVE_MISSIONS_METRIC_ID = 'active_missions'
export const ACTIVE_MISSIONS_LABEL = 'Misiones activas'

/**
 * Synthetic slot: response plans/actions formally started and in execution.
 * Unavailable until a canonical active-response source exists — we never infer
 * responses from missions, recommendations, decisions or response assessments.
 */
export const ACTIVE_RESPONSES_METRIC_ID = 'active_responses'
export const ACTIVE_RESPONSES_LABEL = 'Respuestas en marcha'
export const ACTIVE_RESPONSES_PENDING_SUBTITLE = 'Seguimiento de respuestas pendiente'
export const ACTIVE_RESPONSES_PENDING_EXPLANATION =
  'El conteo estará disponible cuando existan planes o acciones de respuesta canónicos con estado de ejecución.'

/** Synthetic slot for the decision queue (until a dedicated registry metric). */
export const PENDING_DECISIONS_METRIC_ID = 'pending_decisions'

/** Display label for the decisions slot (decision queue proxy). */
export const PENDING_DECISIONS_LABEL = 'Decisiones pendientes'

/**
 * Canonical "misión activa" status set — re-exported from the operational
 * comparison util so the server-side comparison and the client fallback
 * (`countActiveMissions`) share ONE definition.
 */
export { ACTIVE_MISSION_STATUSES }

/** Display-label overrides so the national row reads as multi-event. */
const KPI_DISPLAY_LABEL_OVERRIDE: Record<string, string> = {
  fire_observations: 'Observaciones totales',
}

export const SITUATION_PERIOD_OPTIONS = [
  { key: '24h', label: '24 horas', hours: 24 },
  { key: '48h', label: '48 horas', hours: 48 },
  { key: '7d', label: '7 días', hours: 168 },
  { key: '30d', label: '30 días', hours: 720 },
] as const

export type SituationPeriodKey = (typeof SITUATION_PERIOD_OPTIONS)[number]['key']

export const SITUATION_TABS = [
  { id: 'panorama', label: 'Panorama' },
  { id: 'actividad', label: 'Actividad' },
  { id: 'verificacion', label: 'Verificación' },
  { id: 'operaciones', label: 'Operaciones' },
  { id: 'timeline', label: 'Cronología' },
] as const

export type SituationTabId = (typeof SITUATION_TABS)[number]['id']

/** Metrics whose headline value is current state — period selector must not relabel silently. */
export const CURRENT_STATE_METRIC_IDS = new Set<string>([
  'findings_active',
  'findings_monitoring',
  'findings_resolved',
  'findings_total',
  'priorities_total',
  'incidents_operational',
  'incidents_legacy',
  'missions_operational',
  'missions_demo',
  'evidence_operational',
  'evidence_demo',
  'verification_plans_legacy',
  'verification_needs_active',
  'response_assessments',
  EVENTS_ACTIVE_METRIC_ID,
  PRIORITY_THREATS_METRIC_ID,
  ACTIVE_MISSIONS_METRIC_ID,
  ACTIVE_RESPONSES_METRIC_ID,
  PENDING_DECISIONS_METRIC_ID,
])

/** Reason a KPI value cannot be shown yet — never faked with a proxy count. */
export interface KpiUnavailable {
  status: 'not_implemented' | 'insufficient_data'
  explanation: string
}

export interface PrimaryKpiItem {
  id: string
  label: string
  value: number
  timeWindowLabel: string
  isCurrentState: boolean
  breakdown: ExecutiveMetric['breakdown']
  href?: string
  secondary?: string
  /** When set the card shows an honest placeholder ("—") instead of `value`. */
  unavailable?: KpiUnavailable
}

/** Canonical inputs for the visible executive KPI row (single normalizer). */
export interface PrimaryKpiInput {
  metrics: ExecutiveMetric[]
  /** Cross-type active event count (registry-derived). */
  eventsActive: number
  /** Missions assigned or in execution (operational comparison / fallback). */
  activeMissions: number
  /** Response plans/actions formally started (0 until a canonical source). */
  activeResponses: number
  /** Decisions awaiting review or approval. */
  pendingDecisions: number
}

export function pickPrimaryMetrics(metrics: ExecutiveMetric[]): ExecutiveMetric[] {
  const byId = new Map(metrics.map((m) => [m.id, m]))
  return PRIMARY_KPI_METRIC_IDS.map((id) => byId.get(id)).filter(Boolean) as ExecutiveMetric[]
}

function legacyExcludedTotal(metric: ExecutiveMetric | undefined): number {
  if (!metric) return 0
  return metric.breakdown.filter((b) => !b.included && b.classification === 'legacy').reduce((s, b) => s + b.value, 0)
}

function metricToKpi(m: ExecutiveMetric): PrimaryKpiItem {
  const isCurrentState = CURRENT_STATE_METRIC_IDS.has(m.id)
  let secondary: string | undefined
  if (m.id === 'incidents_operational') {
    const legacy = legacyExcludedTotal(m)
    if (legacy > 0) {
      secondary = `${pluralizeCount(legacy, 'registro histórico', 'registros históricos')} ${HISTORICAL_PENDING_ORG_SUFFIX}`
    }
  }
  return {
    id: m.id,
    label: KPI_DISPLAY_LABEL_OVERRIDE[m.id] ?? m.label,
    value: m.value,
    timeWindowLabel: isCurrentState ? 'Estado actual' : m.timeWindow.label,
    isCurrentState,
    breakdown: m.breakdown,
    secondary,
  }
}

/**
 * Build TerraMind's visible primary KPI row, in the approved order:
 *   Observaciones totales · Eventos activos · Amenazas prioritarias ·
 *   Misiones activas · Respuestas en marcha · Decisiones pendientes.
 *
 * This is the single normalizer: canonical inputs → NationalExecutiveKpis. No
 * card fetches its own source. Amenazas prioritarias is intentionally
 * unavailable (never a renamed findings/priorities/incidents count) until the
 * Canonical Threat Engine exists — see `CanonicalThreatSummary` (future).
 */
export function buildPrimaryKpis(input: PrimaryKpiInput): PrimaryKpiItem[] {
  const { metrics, eventsActive, activeMissions, activeResponses, pendingDecisions } = input
  const byId = new Map(metrics.map((m) => [m.id, m]))
  const items: PrimaryKpiItem[] = []

  // 1. Observaciones totales (real observations from enabled sources).
  const observations = byId.get('fire_observations')
  if (observations) items.push(metricToKpi(observations))

  // 2. Eventos activos (cross-type registry count — matches map & distribution).
  items.push({
    id: EVENTS_ACTIVE_METRIC_ID,
    label: EVENTS_ACTIVE_LABEL,
    value: eventsActive,
    timeWindowLabel: 'Estado actual',
    isCurrentState: true,
    breakdown: [],
  })

  // 3. Amenazas prioritarias — honest unavailable state until the threat engine.
  items.push({
    id: PRIORITY_THREATS_METRIC_ID,
    label: PRIORITY_THREATS_LABEL,
    value: 0,
    timeWindowLabel: 'Estado actual',
    isCurrentState: true,
    breakdown: [],
    unavailable: {
      status: 'not_implemented',
      explanation: PRIORITY_THREATS_PENDING_EXPLANATION,
    },
  })

  // 4. Misiones activas (assigned / in execution).
  items.push({
    id: ACTIVE_MISSIONS_METRIC_ID,
    label: ACTIVE_MISSIONS_LABEL,
    value: activeMissions,
    timeWindowLabel: 'Estado actual',
    isCurrentState: true,
    breakdown: [],
    href: '/misiones',
  })

  // 5. Respuestas en marcha — honest unavailable state until a canonical
  // active-response source exists. `activeResponses` is reserved for that future
  // wiring (CanonicalResponseSummary) and never inferred from other stages.
  void activeResponses
  items.push({
    id: ACTIVE_RESPONSES_METRIC_ID,
    label: ACTIVE_RESPONSES_LABEL,
    value: 0,
    timeWindowLabel: 'Estado actual',
    isCurrentState: true,
    breakdown: [],
    unavailable: {
      status: 'not_implemented',
      explanation: ACTIVE_RESPONSES_PENDING_EXPLANATION,
    },
  })

  // 6. Decisiones pendientes (require review/approval).
  items.push({
    id: PENDING_DECISIONS_METRIC_ID,
    label: PENDING_DECISIONS_LABEL,
    value: pendingDecisions,
    timeWindowLabel: 'Estado actual',
    isCurrentState: true,
    breakdown: [],
    href: '/respuesta',
  })

  return items.slice(0, PRIMARY_KPI_LIMIT)
}

/**
 * Count missions that are assigned or in execution, excluding demo unless the
 * demo toggle is on. Used as a fallback when the server-side operational
 * comparison is unavailable (the DTO's `missions_in_progress` is capped, so it
 * is only a fallback, never the canonical count).
 */
export function countActiveMissions(
  missions: Array<{ status: string; is_internal_demo?: boolean }>,
  includeDemo: boolean,
): number {
  return missions.filter(
    (m) =>
      (includeDemo || !m.is_internal_demo) && ACTIVE_MISSION_STATUSES.has(m.status),
  ).length
}

export function filterEntriesByPeriod<T extends { timestamp: string }>(
  entries: T[],
  periodHours: number,
  now = Date.now(),
): T[] {
  const cutoff = now - periodHours * 3_600_000
  return entries.filter((e) => new Date(e.timestamp).getTime() >= cutoff)
}

/** Registry-backed methodology lines for “Ver metodología”. */
export function metricMethodologyLines(metricId: string): string[] {
  const entry = getMetricRegistryEntry(metricId)
  if (!entry) return []
  return [
    entry.description,
    `Fuentes: ${entry.source_table_or_service}`,
    `Ventana: ${entry.time_window}`,
    `Limitaciones: ${entry.confidence_or_limitations}`,
  ]
}
