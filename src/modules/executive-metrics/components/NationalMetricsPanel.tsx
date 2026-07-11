import { useState } from 'react'

import { useExecutiveMetrics, useDataQualitySummary } from '@/modules/executive-metrics/hooks/useExecutiveMetrics'
import { MetricCard } from './MetricCard'
import { DataQualityCard } from './DataQualityCard'

/**
 * Canonical, contradiction-free national KPI panel. Single source of truth: the
 * Executive Metrics Service. Demo is excluded by default; enabling it shows a
 * visible banner and never sums demo silently into operational values.
 */
export function NationalMetricsPanel() {
  const [includeDemo, setIncludeDemo] = useState(false)
  const metricsQuery = useExecutiveMetrics({ includeDemo })
  const dqQuery = useDataQualitySummary()

  const metrics = metricsQuery.data?.metrics ?? []

  return (
    <section
      data-testid="national-metrics-panel"
      className="space-y-4 rounded-xl border border-border-subtle bg-surface-2/40 px-5 py-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Indicadores nacionales
          </p>
          <p className="text-xs text-text-secondary">
            Conteos canónicos · demo {includeDemo ? 'incluida' : 'excluida'} por defecto
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            aria-label="Incluir demostración interna en indicadores nacionales"
            checked={includeDemo}
            onChange={(e) => setIncludeDemo(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border-subtle"
          />
          Incluir demostración interna
        </label>
      </div>

      {includeDemo && (
        <div className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm text-violet-200">
          Mostrando datos de demostración interna en breakdown separado — no representan
          actividad operacional confirmada.
        </div>
      )}

      {metricsQuery.isLoading ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-surface-3/50" />
          ))}
        </div>
      ) : metricsQuery.isError ? (
        <p className="text-sm text-red-300">No se pudieron cargar los indicadores.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m) => (
            <MetricCard key={m.id} metric={m} />
          ))}
        </div>
      )}

      {dqQuery.data && <DataQualityCard summary={dqQuery.data} />}
    </section>
  )
}
