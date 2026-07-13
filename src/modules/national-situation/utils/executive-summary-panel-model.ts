/**
 * View-model for the left-hand "Resumen ejecutivo" panel on Situación Nacional.
 *
 * Produces the five reference rows (qué ocurre · qué cambió · riesgo económico ·
 * costo de no actuar · recomienda TerraMind). Economic aggregates return
 * "Pendiente" until a canonical national exposure model exists.
 */
import type { ExecutiveDashboardDto } from '@/modules/executive-demo/types/executive-demo.types'
import type { ExecutiveMetric } from '@/modules/executive-metrics/executive-metric.types'
import { pluralizeCount } from '@/shared/format/plural'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  BarChart3,
  CircleDollarSign,
  ClipboardCheck,
  Flame,
  TrendingUp,
} from 'lucide-react'
import type { DashboardEventType } from '../hooks/useDashboardEventTypes'
import type { NationalExecutiveSummary } from '../national-executive-summary'
import { filterEntriesByPeriod } from '../national-situation.constants'
import { periodWindowPhrase } from './situation-labels'

export const EXEC_SUMMARY_PENDING = 'Pendiente' as const

export type ExecutiveSummaryRowKind = 'prose' | 'metric'

interface ExecutiveSummaryRowBase {
  id: string
  title: string
  titleClassName: string
  icon: LucideIcon
  iconClassName: string
}

export interface ExecutiveSummaryProseRow extends ExecutiveSummaryRowBase {
  kind: 'prose'
  content: string
}

export interface ExecutiveSummaryMetricRow extends ExecutiveSummaryRowBase {
  kind: 'metric'
  metricLabel: string
  metricValue: string
}

export type ExecutiveSummaryPanelRow = ExecutiveSummaryProseRow | ExecutiveSummaryMetricRow

export interface ExecutiveSummaryPanelModel {
  rows: ExecutiveSummaryPanelRow[]
}

function metricValue(metrics: ExecutiveMetric[], id: string): number {
  return metrics.find((m) => m.id === id)?.value ?? 0
}

function formatQuetzalesMillions(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return EXEC_SUMMARY_PENDING
  const millions = amount / 1_000_000
  const formatted =
    millions >= 100
      ? Math.round(millions).toLocaleString('es-GT')
      : millions.toLocaleString('es-GT', { maximumFractionDigits: 0 })
  return `Q ${formatted} millones`
}

function readNationalExposure(
  dashboard: ExecutiveDashboardDto | undefined,
  key: 'productiveValueGtq' | 'potentialLossGtq',
): string {
  const metadata = (dashboard as { metadata?: Record<string, unknown> } | undefined)?.metadata
  const raw = metadata?.[key]
  if (typeof raw === 'number') return formatQuetzalesMillions(raw)
  if (typeof raw === 'string' && raw.trim()) return raw
  return EXEC_SUMMARY_PENDING
}

function dominantEventNarrative(types: DashboardEventType[]): string {
  if (types.length === 0) return ''

  const ranked = [...types].sort((a, b) => b.newCount - a.newCount || b.activeCount - a.activeCount)
  const lead = ranked[0]

  if (lead.type === 'rainfall_deficit') {
    if (lead.newCount > 0) {
      return 'Aumenta el déficit de precipitación en el territorio monitoreado.'
    }
    if (lead.activeCount > 0) {
      return 'Persiste el déficit de precipitación en zonas del corredor seco.'
    }
  }

  if (lead.type === 'thermal_activity' && lead.activeCount > 0) {
    return 'Persiste actividad térmica satelital en varios departamentos.'
  }

  if (lead.activeCount > 0) {
    return `Persiste señal activa de ${lead.label.toLowerCase()}.`
  }

  return ''
}

function buildWhatIsHappening(types: DashboardEventType[], totalActive: number): string {
  if (totalActive <= 0) {
    return 'No hay eventos activos en la ventana seleccionada.'
  }

  const narrative = dominantEventNarrative(types)
  const base = `Persisten ${totalActive.toLocaleString('es-GT')} eventos activos.`
  return narrative ? `${base} ${narrative}` : base
}

function periodComparisonPhrase(periodHours: number): string {
  if (periodHours <= 24) return '24h'
  if (periodHours <= 48) return '48h'
  if (periodHours <= 168) return '7 días'
  return '30 días'
}

export { periodComparisonPhrase }

function buildWhatChanged(
  types: DashboardEventType[],
  totalActive: number,
  periodHours: number,
  dashboard: ExecutiveDashboardDto | undefined,
  fallback: string,
): string {
  const totalNew = types.reduce((sum, t) => sum + t.newCount, 0)
  const previous = Math.max(totalActive - totalNew, 0)

  let lead = ''
  if (previous > 0 && totalNew > 0) {
    const pct = Math.round((totalNew / previous) * 100)
    lead = `+${pct}% eventos activos vs. ${periodComparisonPhrase(periodHours)} anteriores.`
  } else if (totalNew > 0) {
    lead = `${pluralizeCount(totalNew, 'evento nuevo', 'eventos nuevos')} en ${periodWindowPhrase(periodHours)}.`
  } else {
    const periodChanges = filterEntriesByPeriod(dashboard?.recent_changes ?? [], periodHours)
    const newEvents = periodChanges.filter((e) => e.stage === 'event').length
    if (newEvents > 0) {
      lead = `${pluralizeCount(newEvents, 'evento nuevo', 'eventos nuevos')} en ${periodWindowPhrase(periodHours)}.`
    } else {
      return fallback
    }
  }

  const rainfall = types.find((t) => t.type === 'rainfall_deficit')
  if (rainfall && rainfall.newCount > 0) {
    return `${lead} Se intensifica la señal de déficit de precipitación.`
  }

  const newFindings = filterEntriesByPeriod(dashboard?.recent_changes ?? [], periodHours).filter(
    (e) => e.stage === 'finding',
  ).length
  if (newFindings > 0) {
    return `${lead} ${pluralizeCount(newFindings, 'hallazgo nuevo', 'hallazgos nuevos')} en el periodo.`
  }

  return lead
}

function buildRecommendation(
  summary: NationalExecutiveSummary,
  metrics: ExecutiveMetric[],
  dashboard: ExecutiveDashboardDto | undefined,
): string {
  const verifNeeds = metricValue(metrics, 'verification_needs_active')
  const topPriorities = dashboard?.top_priorities?.length ?? 0
  const assessments = metricValue(metrics, 'response_assessments')

  if (verifNeeds > 0 || topPriorities > 0) {
    return 'Verificar en campo zonas críticas y activar apoyo focalizado a productores más expuestos.'
  }
  if (assessments > 0) {
    return summary.terramind_recommends
  }
  if (summary.terramind_recommends && !summary.terramind_recommends.includes('Aún no existe')) {
    return summary.terramind_recommends
  }
  return EXEC_SUMMARY_PENDING
}

export function buildExecutiveSummaryPanelModel(input: {
  types: DashboardEventType[]
  totalActive: number
  periodHours: number
  summary: NationalExecutiveSummary
  metrics: ExecutiveMetric[]
  dashboard: ExecutiveDashboardDto | undefined
}): ExecutiveSummaryPanelModel {
  const { types, totalActive, periodHours, summary, metrics, dashboard } = input

  const rows: ExecutiveSummaryPanelRow[] = [
    {
      id: 'what_is_happening',
      kind: 'prose',
      title: 'Qué ocurre',
      titleClassName: 'text-[#5b8def]',
      icon: Flame,
      iconClassName: 'bg-orange-500/15 text-[#fb923c]',
      content: buildWhatIsHappening(types, totalActive),
    },
    {
      id: 'what_changed',
      kind: 'prose',
      title: 'Qué cambió',
      titleClassName: 'text-[#f5c518]',
      icon: TrendingUp,
      iconClassName: 'bg-amber-500/15 text-[#f5c518]',
      content: buildWhatChanged(types, totalActive, periodHours, dashboard, summary.what_changed),
    },
    {
      id: 'economic_risk',
      kind: 'metric',
      title: 'Riesgo económico',
      titleClassName: 'text-[#86efac]',
      icon: CircleDollarSign,
      iconClassName: 'bg-emerald-500/15 text-[#86efac]',
      metricLabel: 'Valor productivo expuesto:',
      metricValue: readNationalExposure(dashboard, 'productiveValueGtq'),
    },
    {
      id: 'inaction_cost',
      kind: 'metric',
      title: 'Costo de no actuar',
      titleClassName: 'text-[#fb923c]',
      icon: AlertTriangle,
      iconClassName: 'bg-red-500/15 text-[#fb923c]',
      metricLabel: 'Pérdida potencial estimada:',
      metricValue: readNationalExposure(dashboard, 'potentialLossGtq'),
    },
    {
      id: 'terramind_recommends',
      kind: 'prose',
      title: 'Recomienda TerraMind',
      titleClassName: 'text-[#60a5fa]',
      icon: ClipboardCheck,
      iconClassName: 'bg-sky-500/15 text-[#60a5fa]',
      content: buildRecommendation(summary, metrics, dashboard),
    },
  ]

  return { rows }
}

/** Header icon for the panel shell (exported for the component). */
export const EXECUTIVE_SUMMARY_HEADER_ICON = BarChart3
