import type { FireSummaryDto } from '@/modules/fires/types/fire.dto'
import type { FirePeriodPreset } from '@/modules/fires/config/fire.constants'
import { thermalPeriodLabel } from '@/modules/fires/utils/thermal-labels'
import { cn } from '@/shared/utils/cn'

interface FireSummaryStripProps {
  summary?: FireSummaryDto
  period: FirePeriodPreset
  filteredEventCount?: number
  hasActiveFilters?: boolean
  isLoading?: boolean
}

function Metric({
  label,
  sublabel,
  value,
  highlight,
}: {
  label: string
  sublabel?: string
  value: string | number
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border-subtle bg-surface-2/60 px-4 py-3',
        highlight && 'border-confidence-medium/40',
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
        {label}
      </p>
      {sublabel && (
        <p className="mt-0.5 text-[10px] text-text-tertiary">{sublabel}</p>
      )}
      <p
        className={cn(
          'mt-1 font-mono text-xl font-semibold',
          highlight ? 'text-status-warning' : 'text-text-primary',
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function FireSummaryStrip({
  summary,
  period,
  filteredEventCount,
  hasActiveFilters,
  isLoading,
}: FireSummaryStripProps) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-3" />
        ))}
      </div>
    )
  }

  const periodText = thermalPeriodLabel(period)
  const groupedEventsValue =
    hasActiveFilters && filteredEventCount !== undefined
      ? filteredEventCount
      : summary.events_count

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-tertiary">
        Métricas del periodo ({periodText}).{' '}
        {hasActiveFilters && filteredEventCount !== undefined && (
          <span>
            Con filtros activos: {filteredEventCount} evento
            {filteredEventCount === 1 ? '' : 's'} visibles.
          </span>
        )}
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric
          label="Observaciones recibidas"
          sublabel={periodText}
          value={summary.observations_downloaded}
        />
        <Metric
          label="Detecciones nacionales"
          sublabel={periodText}
          value={summary.detections_count}
        />
        <Metric
          label="Eventos térmicos agrupados"
          sublabel={hasActiveFilters ? 'según filtros' : periodText}
          value={groupedEventsValue}
        />
        <Metric
          label="Requieren atención"
          sublabel={periodText}
          value={summary.attention_events_count}
          highlight={summary.attention_events_count > 0}
        />
        <Metric
          label="Multi-satélite"
          sublabel={periodText}
          value={summary.multisatellite_events_count}
        />
        <Metric
          label="Departamentos"
          sublabel={periodText}
          value={summary.departments_affected_count}
        />
      </div>
    </div>
  )
}
