import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNationalSituation } from '../NationalSituationContext'
import { PRIMARY_KPI_LIMIT } from '../national-situation.constants'
import { buildSituationMethodologyPresentation } from '../utils/methodology-presentation'
import {
  buildExecutiveKpiCardModels,
  KPI_TREND_NO_COMPARISON,
  kpiTrendClassName,
} from '../utils/executive-kpi-panel-model'
import { markSituationPerformance } from '../situation-performance'

function KpiCard({
  card,
  onOpenMethodology,
}: {
  card: ReturnType<typeof buildExecutiveKpiCardModels>[number]
  onOpenMethodology: (id: string) => void
}) {
  const Icon = card.icon
  const hasMethodology = buildSituationMethodologyPresentation(card.id) != null

  const valueClass = card.isUnavailable
    ? 'text-[26px] font-bold leading-none tracking-tight text-[#6b6b78]'
    : 'text-[26px] font-bold leading-none tracking-tight text-text-primary'

  return (
    <div
      className="group relative flex min-h-[108px] flex-col rounded-lg border border-border-subtle bg-[#161b26] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
      data-testid={`executive-kpi-${card.id}`}
      title={card.tooltip}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-h-[2rem] flex-1 text-[11px] font-medium leading-tight text-[#c7c7d1]">
          {card.label}
        </p>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${card.iconClassName}`}
          aria-hidden
        >
          <Icon size={14} />
        </span>
      </div>

      {card.href && !card.isUnavailable ? (
        <Link to={card.href} className={`${valueClass} hover:text-accent`}>
          {card.formattedValue}
        </Link>
      ) : (
        <p className={`${valueClass} tabular-nums`} aria-label={card.isUnavailable ? 'No disponible' : undefined}>
          {card.formattedValue}
        </p>
      )}

      <p className="mt-1 text-[10px] text-[#9898a4]">{card.subtitle}</p>

      {card.showTrend && (
        <p
          className={`mt-1.5 text-[10px] font-medium tabular-nums ${kpiTrendClassName(card.trendDirection)}`}
        >
          {card.trendLabel}
        </p>
      )}

      {hasMethodology && (
        <button
          type="button"
          onClick={() => onOpenMethodology(card.id)}
          className="mt-1 text-left text-[9px] text-accent opacity-0 transition-opacity group-hover:opacity-100"
        >
          Ver metodología
        </button>
      )}
    </div>
  )
}

export function ExecutiveKpiGrid() {
  const { primaryKpis, metricsQuery, periodHours, dashboardQuery } = useNationalSituation()
  const [methodologyId, setMethodologyId] = useState<string | null>(null)

  const cards = useMemo(
    () =>
      buildExecutiveKpiCardModels({
        primaryKpis,
        periodHours,
        dashboard: dashboardQuery.data,
      }),
    [primaryKpis, periodHours, dashboardQuery.data],
  )

  useEffect(() => {
    if (cards.length > 0) markSituationPerformance('kpis_rendered')
  }, [cards.length])

  if (metricsQuery.isLoading) {
    return (
      <div
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        data-testid="executive-kpi-grid-loading"
      >
        {Array.from({ length: PRIMARY_KPI_LIMIT }).map((_, i) => (
          <div key={i} className="h-[108px] animate-pulse rounded-lg bg-[#161b26]/80" />
        ))}
      </div>
    )
  }

  if (metricsQuery.isError) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        No se pudieron cargar los indicadores principales.{' '}
        <button type="button" onClick={() => metricsQuery.refetch()} className="underline">
          Reintentar
        </button>
      </div>
    )
  }

  const methodology =
    methodologyId != null ? buildSituationMethodologyPresentation(methodologyId) : null

  return (
    <>
      <div
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        data-testid="executive-kpi-grid"
      >
        {cards.map((card) => (
          <KpiCard key={card.id} card={card} onOpenMethodology={setMethodologyId} />
        ))}
      </div>

      {methodology && (
        <div
          className="mt-2 rounded-lg border border-border-subtle bg-surface-2/60 px-4 py-3 text-xs"
          data-testid="kpi-methodology-panel"
        >
          <div className="flex items-center justify-between">
            <p className="font-medium text-text-primary">Metodología</p>
            <button type="button" onClick={() => setMethodologyId(null)} className="text-text-tertiary">
              Cerrar
            </button>
          </div>
          <p className="mt-2 text-sm text-text-primary">{methodology.summary}</p>
          <dl className="mt-3 space-y-1.5">
            {methodology.lines.map((line) => (
              <div key={line.label} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-2">
                <dt className="text-text-tertiary">{line.label}</dt>
                <dd className="text-text-secondary">{line.value}</dd>
              </div>
            ))}
          </dl>
          <details className="mt-3 border-t border-border-subtle pt-2">
            <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
              Referencia técnica
            </summary>
            <pre className="mt-2 overflow-x-auto rounded border border-border-subtle bg-surface-1/50 p-2 font-mono text-[10px] text-text-tertiary">
              {methodology.technicalReference}
            </pre>
          </details>
        </div>
      )}

      {cards.length > 0 &&
      cards.every((card) => !card.showTrend || card.trendLabel === KPI_TREND_NO_COMPARISON) ? (
        <span className="sr-only">
          Sin periodo comparable: las tendencias se muestran solo cuando existe una
          ventana histórica equivalente.
        </span>
      ) : null}
    </>
  )
}
