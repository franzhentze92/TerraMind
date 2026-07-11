import type { ExecutiveMetric } from '@/modules/executive-metrics/executive-metric.types'
import { getMetricRegistryEntry } from '@/modules/executive-metrics/metric-registry'
import { pluralizeCount } from '@/shared/format/plural'
import { HISTORICAL_PENDING_ORG_SUFFIX } from './utils/situation-labels'

/** Maximum primary KPIs visible in the executive overview (Phase 3 §2). */
export const PRIMARY_KPI_LIMIT = 6

/** First five canonical metric ids — ExecutiveMetricsService only. */
export const PRIMARY_KPI_METRIC_IDS = [
  'fire_observations',
  'fire_detections_national',
  'fire_events',
  'findings_active',
  'incidents_operational',
] as const

export type PrimaryKpiMetricId = (typeof PRIMARY_KPI_METRIC_IDS)[number]

/** Synthetic sixth slot until a dedicated registry metric exists. */
export const PENDING_DECISIONS_METRIC_ID = 'pending_decisions'

/** Display label for the 6th slot (decision queue proxy). */
export const PENDING_DECISIONS_LABEL = 'Decisiones pendientes'

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
  PENDING_DECISIONS_METRIC_ID,
])

export interface PrimaryKpiItem {
  id: string
  label: string
  value: number
  timeWindowLabel: string
  isCurrentState: boolean
  breakdown: ExecutiveMetric['breakdown']
  href?: string
  secondary?: string
}

export function pickPrimaryMetrics(metrics: ExecutiveMetric[]): ExecutiveMetric[] {
  const byId = new Map(metrics.map((m) => [m.id, m]))
  return PRIMARY_KPI_METRIC_IDS.map((id) => byId.get(id)).filter(Boolean) as ExecutiveMetric[]
}

function legacyExcludedTotal(metric: ExecutiveMetric | undefined): number {
  if (!metric) return 0
  return metric.breakdown.filter((b) => !b.included && b.classification === 'legacy').reduce((s, b) => s + b.value, 0)
}

/** Build the six primary KPI display items for the overview grid. */
export function buildPrimaryKpis(
  metrics: ExecutiveMetric[],
  pendingDecisions: number,
): PrimaryKpiItem[] {
  const canonical = pickPrimaryMetrics(metrics)
  const items: PrimaryKpiItem[] = canonical.map((m) => {
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
      label: m.label,
      value: m.value,
      timeWindowLabel: isCurrentState ? 'Estado actual' : m.timeWindow.label,
      isCurrentState,
      breakdown: m.breakdown,
      secondary,
    }
  })

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
