import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DataClassification } from '@/modules/executive-metrics/metric-taxonomy'
import { exclusionReasonLabel } from '@/shared/product-language'
import { useNationalSituation } from '../NationalSituationContext'
import { PRIMARY_KPI_LIMIT } from '../national-situation.constants'
import { buildSituationMethodologyPresentation } from '../utils/methodology-presentation'
import { situationClassificationLabel } from '../utils/situation-labels'
import { markSituationPerformance } from '../situation-performance'

const CLASS_DOT: Record<DataClassification, string> = {
  operational: 'bg-emerald-400',
  legacy: 'bg-amber-400',
  demo: 'bg-violet-400',
  pending: 'bg-sky-400',
  excluded: 'bg-zinc-500',
  unresolved_ownership: 'bg-amber-400',
}

export function ExecutiveKpiGrid() {
  const { primaryKpis, metricsQuery } = useNationalSituation()
  const [methodologyId, setMethodologyId] = useState<string | null>(null)

  useEffect(() => {
    if (primaryKpis.length > 0) markSituationPerformance('kpis_rendered')
  }, [primaryKpis.length])

  if (metricsQuery.isLoading) {
    return (
      <div
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        data-testid="executive-kpi-grid-loading"
      >
        {Array.from({ length: PRIMARY_KPI_LIMIT }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-3/50" />
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
        {primaryKpis.map((kpi) => {
          const excluded = kpi.breakdown.filter((b) => !b.included)
          const hasMethodology = buildSituationMethodologyPresentation(kpi.id) != null
          return (
            <div
              key={kpi.id}
              className="group relative rounded-lg border border-border-subtle bg-surface-1/40 px-3 py-2.5"
            >
              <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{kpi.label}</p>
              {kpi.href ? (
                <Link to={kpi.href} className="text-2xl font-semibold text-accent hover:underline">
                  {kpi.value}
                </Link>
              ) : (
                <p className="text-2xl font-semibold text-text-primary">{kpi.value}</p>
              )}
              <p className="text-[10px] text-text-tertiary">{kpi.timeWindowLabel}</p>
              {kpi.secondary && (
                <p className="mt-1 text-[10px] text-amber-300">{kpi.secondary}</p>
              )}
              {excluded.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 border-t border-border-subtle pt-1.5">
                  {excluded.map((item, idx) => (
                    <li key={`${item.label}-${idx}`} className="flex items-center gap-1 text-[10px]">
                      <span className={`h-1 w-1 rounded-full ${CLASS_DOT[item.classification]}`} />
                      <span className="text-text-secondary">
                        {situationClassificationLabel(item.classification)}:
                      </span>
                      <span className="text-text-primary">{item.value}</span>
                      {item.reason && (
                        <span className="text-text-tertiary">· {exclusionReasonLabel(item.reason)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {hasMethodology && (
                <button
                  type="button"
                  onClick={() => setMethodologyId(kpi.id)}
                  className="mt-1 text-[10px] text-accent opacity-0 group-hover:opacity-100"
                >
                  Ver metodología
                </button>
              )}
            </div>
          )
        })}
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
    </>
  )
}
