import type { FireSummaryDto } from '@/modules/fires/types/fire.dto'
import { cn } from '@/shared/utils/cn'

interface FireSummaryStripProps {
  summary?: FireSummaryDto
  isLoading?: boolean
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string
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

export function FireSummaryStrip({ summary, isLoading }: FireSummaryStripProps) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-3" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Metric label="Eventos térmicos" value={summary.events_count} />
      <Metric label="Detecciones satelitales" value={summary.detections_count} />
      <Metric
        label="Requieren atención"
        value={summary.attention_events_count}
        highlight={summary.attention_events_count > 0}
      />
      <Metric label="Eventos probables" value={summary.probable_events_count} />
      <Metric label="Multi-satélite" value={summary.multisatellite_events_count} />
      <Metric label="Departamentos" value={summary.departments_affected_count} />
    </div>
  )
}
