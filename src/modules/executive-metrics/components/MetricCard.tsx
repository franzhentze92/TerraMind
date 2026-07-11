import type { ExecutiveMetric } from '@/modules/executive-metrics/executive-metric.types'
import type { DataClassification } from '@/modules/executive-metrics/metric-taxonomy'
import { exclusionReasonLabel } from '@/shared/product-language'
import { formatRelative } from '@/shared/time/presentation'

const CLASS_DOT: Record<DataClassification, string> = {
  operational: 'bg-emerald-400',
  legacy: 'bg-amber-400',
  demo: 'bg-violet-400',
  pending: 'bg-sky-400',
  excluded: 'bg-zinc-500',
  unresolved_ownership: 'bg-amber-400',
}

/**
 * Canonical metric card. Shows the operational headline value plus an explicit
 * breakdown (legacy / demo / pending) so the number can never look contradictory
 * without an explanation.
 */
export function MetricCard({ metric }: { metric: ExecutiveMetric }) {
  const excluded = metric.breakdown.filter((b) => !b.included)
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1/40 px-3 py-3">
      <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{metric.label}</p>
      <p className="mt-0.5 text-2xl font-semibold text-text-primary">{metric.value}</p>
      <p className="text-[10px] text-text-tertiary">{metric.timeWindow.label}</p>

      {excluded.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-border-subtle pt-2">
          {excluded.map((item, idx) => (
            <li key={`${item.label}-${idx}`} className="flex items-center gap-1.5 text-[11px]">
              <span className={`h-1.5 w-1.5 rounded-full ${CLASS_DOT[item.classification]}`} />
              <span className="text-text-secondary">{item.label}:</span>
              <span className="font-medium text-text-primary">{item.value}</span>
              {item.reason && (
                <span className="text-text-tertiary">· {exclusionReasonLabel(item.reason)}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {metric.lastUpdatedAt && (
        <p className="mt-2 text-[10px] text-text-tertiary">
          Actualizado {formatRelative(metric.lastUpdatedAt)}
        </p>
      )}
    </div>
  )
}
