/**
 * View-model for the "Estado operativo" panel on Situación Nacional.
 */
import type { LucideIcon } from 'lucide-react'
import { BadgeCheck, ClipboardList, FolderOpen, Network, ShieldPlus } from 'lucide-react'
import {
  computePeriodTrendPercent,
  type OperationalPeriodComparison,
} from './operational-period-comparison'
import { KPI_TREND_NO_COMPARISON, type KpiTrendDirection } from './executive-kpi-panel-model'

export interface OperationalStatusCardModel {
  key: string
  label: string
  stateLabel: string
  value: number
  formattedValue: string
  trendLabel: string
  trendDirection: KpiTrendDirection
  href: string
  icon: LucideIcon
  iconClassName: string
  cardClassName: string
  description: string
}

const PRESENTATION: Record<
  string,
  {
    icon: LucideIcon
    iconClassName: string
    cardClassName: string
    stateLabel: string
    description: string
  }
> = {
  verifications: {
    icon: BadgeCheck,
    iconClassName: 'bg-sky-500/20 text-sky-300',
    cardClassName: 'border-sky-500/25 bg-sky-500/[0.06]',
    stateLabel: 'Activas',
    description:
      'Verificaciones activas: solicitudes abiertas para confirmar en campo o con nueva evidencia una señal detectada, antes de escalar la respuesta.',
  },
  missions: {
    icon: Network,
    iconClassName: 'bg-teal-500/20 text-teal-300',
    cardClassName: 'border-teal-500/25 bg-teal-500/[0.06]',
    stateLabel: 'En curso',
    description:
      'Misiones en curso: operaciones de campo asignadas y en ejecución para levantar evidencia estructurada sobre un evento o incidente.',
  },
  evidence: {
    icon: FolderOpen,
    iconClassName: 'bg-amber-500/20 text-[#f5c518]',
    cardClassName: 'border-amber-500/25 bg-amber-500/[0.05]',
    stateLabel: 'Pendiente',
    description:
      'Evidencia pendiente: entregas recibidas desde el campo que aún esperan revisión o validación por parte del equipo.',
  },
  decisions: {
    icon: ClipboardList,
    iconClassName: 'bg-orange-500/20 text-orange-300',
    cardClassName: 'border-orange-500/25 bg-orange-500/[0.05]',
    stateLabel: 'Pendientes',
    description:
      'Decisiones pendientes: recomendaciones que requieren aprobación o resolución humana antes de activar una respuesta.',
  },
  responses: {
    icon: ShieldPlus,
    iconClassName: 'bg-red-500/20 text-red-400',
    cardClassName: 'border-violet-500/25 bg-violet-500/[0.06]',
    stateLabel: 'En marcha',
    description:
      'Respuestas en marcha: acciones o planes de respuesta ya activados y en ejecución sobre el territorio.',
  },
}

function formatShortTrend(percent: number | null): {
  label: string
  direction: KpiTrendDirection
} {
  if (percent === null) {
    return { label: KPI_TREND_NO_COMPARISON, direction: 'unknown' }
  }
  if (percent > 0) {
    return { label: `↑ ${percent}%`, direction: 'up' }
  }
  if (percent < 0) {
    return { label: `↓ ${Math.abs(percent)}%`, direction: 'down' }
  }
  return { label: '→ 0%', direction: 'flat' }
}

function metricComparison(
  comparison: OperationalPeriodComparison | undefined,
  key: keyof OperationalPeriodComparison['metrics'],
  fallback: number,
): { current: number; previous: number } {
  const slice = comparison?.metrics[key]
  if (!slice) return { current: fallback, previous: fallback }
  return slice
}

export function buildOperationalStatusCardModels(input: {
  comparison: OperationalPeriodComparison | undefined
  fallback: {
    verifications: number
    missions: number
    evidence: number
    decisions: number
    responses: number
  }
}): OperationalStatusCardModel[] {
  const rows = [
    { key: 'verifications', label: 'Verificaciones', href: '/verificaciones' },
    { key: 'missions', label: 'Misiones', href: '/misiones' },
    { key: 'evidence', label: 'Evidencia', href: '/misiones' },
    { key: 'decisions', label: 'Decisiones', href: '/respuesta' },
    { key: 'responses', label: 'Respuestas', href: '/respuesta' },
  ] as const

  return rows.map((row) => {
    const preset = PRESENTATION[row.key]
    const counts = metricComparison(
      input.comparison,
      row.key,
      input.fallback[row.key],
    )
    const trendPercent = computePeriodTrendPercent(counts.current, counts.previous)
    const trend = formatShortTrend(trendPercent)

    return {
      key: row.key,
      label: row.label,
      stateLabel: preset.stateLabel,
      value: counts.current,
      formattedValue: counts.current.toLocaleString('es-GT'),
      trendLabel: trend.label,
      trendDirection: trend.direction,
      href: row.href,
      icon: preset.icon,
      iconClassName: preset.iconClassName,
      cardClassName: preset.cardClassName,
      description: preset.description,
    }
  })
}

export function operationalTrendClassName(direction: KpiTrendDirection): string {
  switch (direction) {
    case 'up':
      return 'text-[#4ade80]'
    case 'down':
      return 'text-status-critical'
    case 'flat':
      return 'text-[#9898a4]'
    default:
      return 'text-[#b8b8c2]'
  }
}
