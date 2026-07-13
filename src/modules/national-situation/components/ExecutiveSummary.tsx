import { Info } from 'lucide-react'
import { useMemo } from 'react'
import { useNationalSituation } from '../NationalSituationContext'
import {
  buildExecutiveSummaryPanelModel,
  EXEC_SUMMARY_PENDING,
  EXECUTIVE_SUMMARY_HEADER_ICON,
  type ExecutiveSummaryPanelRow,
} from '../utils/executive-summary-panel-model'

function SummaryRow({ row }: { row: ExecutiveSummaryPanelRow }) {
  const Icon = row.icon

  return (
    <li className="flex gap-2.5 border-b border-border-subtle/50 py-2.5 last:border-b-0 last:pb-0 first:pt-0">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${row.iconClassName}`}
        aria-hidden
      >
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-semibold leading-tight ${row.titleClassName}`}>{row.title}</p>
        {row.kind === 'prose' ? (
          <p className="mt-1 text-[11px] leading-snug text-text-secondary">{row.content}</p>
        ) : (
          <div className="mt-1">
            <p className="text-[10px] text-text-tertiary">{row.metricLabel}</p>
            <p
              className={`mt-0.5 text-[13px] font-bold leading-tight ${
                row.metricValue === EXEC_SUMMARY_PENDING ? 'text-[#b8b8c2]' : 'text-text-primary'
              }`}
            >
              {row.metricValue}
            </p>
          </div>
        )}
      </div>
    </li>
  )
}

export function ExecutiveSummary() {
  const { summary, eventTypes, periodHours, metricsQuery, dashboardQuery } = useNationalSituation()

  const panel = useMemo(
    () =>
      buildExecutiveSummaryPanelModel({
        types: eventTypes.types,
        totalActive: eventTypes.totalActive,
        periodHours,
        summary,
        metrics: metricsQuery.data?.metrics ?? [],
        dashboard: dashboardQuery.data,
      }),
    [
      eventTypes.types,
      eventTypes.totalActive,
      periodHours,
      summary,
      metricsQuery.data?.metrics,
      dashboardQuery.data,
    ],
  )

  const HeaderIcon = EXECUTIVE_SUMMARY_HEADER_ICON

  return (
    <section
      className="flex h-full min-h-0 flex-col rounded-xl border border-border-subtle bg-[#0b111b]/90 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      data-testid="executive-summary"
      aria-label="Resumen ejecutivo"
    >
      <div className="flex items-center gap-1.5">
        <HeaderIcon size={14} className="text-text-tertiary" aria-hidden />
        <p className="flex-1 text-[13px] font-semibold text-text-primary">Resumen ejecutivo</p>
        <button
          type="button"
          className="rounded-full p-0.5 text-text-tertiary transition-colors hover:text-text-secondary"
          aria-label="Información sobre el resumen ejecutivo"
          title="Síntesis determinística a partir de métricas canónicas y eventos activos."
        >
          <Info size={13} aria-hidden />
        </button>
      </div>

      {eventTypes.isLoading || metricsQuery.isLoading ? (
        <div className="mt-3 space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-2.5">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-surface-3/50" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-24 animate-pulse rounded bg-surface-3/40" />
                <div className="h-4 w-full animate-pulse rounded bg-surface-3/30" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ul className="mt-2 flex-1 overflow-y-auto">
          {panel.rows.map((row) => (
            <SummaryRow key={row.id} row={row} />
          ))}
        </ul>
      )}
    </section>
  )
}
