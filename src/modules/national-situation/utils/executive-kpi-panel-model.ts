/**
 * View-model for TerraMind's visible executive KPI row on Situación Nacional.
 *
 * Enriches the canonical primary KPIs (built by `buildPrimaryKpis`) with
 * executive icons, reference subtitles and tooltips, plus honest period trends.
 *
 * Honesty rules:
 * - Trends are shown ONLY when a real comparable window exists (same duration,
 *   same definition). Otherwise the card reads "Sin periodo comparable".
 * - `0` is a valid value and a valid comparison; it is never hidden.
 * - The "Amenazas prioritarias" KPI is unavailable until the Canonical Threat
 *   Engine exists; it shows "—" and never a proxy count.
 */
import type { ExecutiveDashboardDto } from '@/modules/executive-demo/types/executive-demo.types'
import type { LucideIcon } from 'lucide-react'
import { ClipboardCheck, Eye, Flame, ShieldAlert, Target, Workflow } from 'lucide-react'
import type { PrimaryKpiItem } from '../national-situation.constants'
import { computePeriodTrendPercent } from './operational-period-comparison'
import { periodComparisonPhrase } from './executive-summary-panel-model'

/** Shown when there is no defensible comparable window for a metric. */
export const KPI_TREND_NO_COMPARISON = 'Sin periodo comparable' as const

export type KpiTrendDirection = 'up' | 'down' | 'flat' | 'unknown'

export interface ExecutiveKpiCardModel {
  id: string
  label: string
  value: number | null
  formattedValue: string
  subtitle: string
  tooltip: string
  trendLabel: string
  trendDirection: KpiTrendDirection
  showTrend: boolean
  isUnavailable: boolean
  href?: string
  icon: LucideIcon
  iconClassName: string
}

interface KpiPresentation {
  icon: LucideIcon
  iconClassName: string
  subtitle: string | ((periodHours: number) => string)
  tooltip: string
}

/**
 * Executive iconography: colors are functional (not environmental event types).
 * Event-type colors always come from `manifest.accentColor` elsewhere.
 */
const KPI_PRESENTATION: Record<string, KpiPresentation> = {
  fire_observations: {
    icon: Eye,
    iconClassName: 'bg-sky-500/20 text-sky-300',
    subtitle: (periodHours) => periodObservationLabel(periodHours),
    tooltip:
      'Registros recibidos de las fuentes habilitadas durante el periodo seleccionado.',
  },
  events_active: {
    icon: Flame,
    iconClassName: 'bg-red-500/20 text-[#fb923c]',
    subtitle: 'En seguimiento',
    tooltip:
      'Eventos detectados y agrupados que permanecen activos o fueron observados dentro del periodo seleccionado.',
  },
  priority_threats: {
    icon: ShieldAlert,
    iconClassName: 'bg-rose-500/20 text-rose-300',
    subtitle: 'Motor de amenazas pendiente',
    tooltip:
      'Las amenazas prioritarias se calcularán a partir de uno o varios eventos, evidencia, impacto y prioridad ejecutiva.',
  },
  active_missions: {
    icon: Target,
    iconClassName: 'bg-cyan-500/20 text-cyan-300',
    subtitle: 'Aprobadas, asignadas o en ejecución',
    tooltip:
      'Misiones operacionales aprobadas que todavía requieren asignación, ejecución, seguimiento o resolución.',
  },
  active_responses: {
    icon: Workflow,
    iconClassName: 'bg-emerald-500/20 text-emerald-300',
    subtitle: 'Seguimiento de respuestas pendiente',
    tooltip:
      'El conteo estará disponible cuando existan planes o acciones de respuesta canónicos con estado de ejecución.',
  },
  pending_decisions: {
    icon: ClipboardCheck,
    iconClassName: 'bg-amber-500/20 text-[#f5c518]',
    subtitle: 'Requieren aprobación',
    tooltip:
      'Decisiones formales que requieren revisión, selección o aprobación por una autoridad.',
  },
}

function periodObservationLabel(periodHours: number): string {
  if (periodHours <= 24) return 'Últimas 24 horas'
  if (periodHours <= 48) return 'Últimas 48 horas'
  if (periodHours <= 168) return 'Últimos 7 días'
  return 'Últimos 30 días'
}

export function computeTrendPercent(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

function countStageInPeriod(
  dashboard: ExecutiveDashboardDto | undefined,
  stage: string,
  periodHours: number,
  offsetHours = 0,
): number {
  const now = Date.now()
  const end = now - offsetHours * 3_600_000
  const start = end - periodHours * 3_600_000
  return (dashboard?.recent_changes ?? []).filter((entry) => {
    if (entry.stage !== stage) return false
    const ts = new Date(entry.timestamp).getTime()
    return ts >= start && ts < end
  }).length
}

function formatTrendLabel(
  percent: number | null,
  periodHours: number,
): { label: string; direction: KpiTrendDirection } {
  if (percent === null) {
    return { label: KPI_TREND_NO_COMPARISON, direction: 'unknown' }
  }
  const phrase = periodComparisonPhrase(periodHours)
  if (percent > 0) {
    return { label: `↑ ${percent}% vs. ${phrase} anteriores`, direction: 'up' }
  }
  if (percent < 0) {
    return { label: `↓ ${Math.abs(percent)}% vs. ${phrase} anteriores`, direction: 'down' }
  }
  return { label: `→ 0% vs. ${phrase} anteriores`, direction: 'flat' }
}

/**
 * Trend percent for a KPI, or `null` when there is no defensible comparable
 * window. Missions and decisions use the server-computed operational period
 * comparison (same-duration windows); observations use the recent-changes
 * window. Every other KPI has no comparable window yet.
 */
function resolveTrendPercent(
  kpi: PrimaryKpiItem,
  periodHours: number,
  dashboard: ExecutiveDashboardDto | undefined,
): number | null {
  const comparison = dashboard?.operational_period_comparison
  switch (kpi.id) {
    case 'fire_observations': {
      const current = countStageInPeriod(dashboard, 'observation', periodHours, 0)
      const previous = countStageInPeriod(dashboard, 'observation', periodHours, periodHours)
      if (current <= 0 && previous <= 0) return null
      return computeTrendPercent(current, previous)
    }
    case 'active_missions':
      if (!comparison) return null
      return computePeriodTrendPercent(
        comparison.metrics.missions.current,
        comparison.metrics.missions.previous,
      )
    case 'pending_decisions':
      if (!comparison) return null
      return computePeriodTrendPercent(
        comparison.metrics.decisions.current,
        comparison.metrics.decisions.previous,
      )
    default:
      return null
  }
}

function resolvePresentation(kpi: PrimaryKpiItem, periodHours: number) {
  const preset = KPI_PRESENTATION[kpi.id]
  if (!preset) {
    return {
      icon: Eye,
      iconClassName: 'bg-surface-3/60 text-text-secondary',
      subtitle: kpi.timeWindowLabel,
      tooltip: kpi.label,
    }
  }
  const subtitle =
    typeof preset.subtitle === 'function' ? preset.subtitle(periodHours) : preset.subtitle
  return {
    icon: preset.icon,
    iconClassName: preset.iconClassName,
    subtitle,
    tooltip: preset.tooltip,
  }
}

export function buildExecutiveKpiCardModels(input: {
  primaryKpis: PrimaryKpiItem[]
  periodHours: number
  dashboard: ExecutiveDashboardDto | undefined
}): ExecutiveKpiCardModel[] {
  const { primaryKpis, periodHours, dashboard } = input

  return primaryKpis.map((kpi) => {
    const presentation = resolvePresentation(kpi, periodHours)
    const isUnavailable = kpi.unavailable != null

    if (isUnavailable) {
      return {
        id: kpi.id,
        label: kpi.label,
        value: null,
        formattedValue: '—',
        subtitle: presentation.subtitle,
        tooltip: kpi.unavailable?.explanation ?? presentation.tooltip,
        trendLabel: '',
        trendDirection: 'unknown' as KpiTrendDirection,
        showTrend: false,
        isUnavailable: true,
        href: kpi.href,
        icon: presentation.icon,
        iconClassName: presentation.iconClassName,
      }
    }

    const trendPercent = resolveTrendPercent(kpi, periodHours, dashboard)
    const trend = formatTrendLabel(trendPercent, periodHours)

    return {
      id: kpi.id,
      label: kpi.label,
      value: kpi.value,
      formattedValue: kpi.value.toLocaleString('es-GT'),
      subtitle: presentation.subtitle,
      tooltip: presentation.tooltip,
      trendLabel: trend.label,
      trendDirection: trend.direction,
      showTrend: true,
      isUnavailable: false,
      href: kpi.href,
      icon: presentation.icon,
      iconClassName: presentation.iconClassName,
    }
  })
}

export function kpiTrendClassName(direction: KpiTrendDirection): string {
  switch (direction) {
    case 'up':
      return 'text-[#4ade80]'
    case 'down':
      return 'text-status-critical'
    case 'flat':
      return 'text-[#9898a4]'
    default:
      return 'text-[#9898a4]'
  }
}
