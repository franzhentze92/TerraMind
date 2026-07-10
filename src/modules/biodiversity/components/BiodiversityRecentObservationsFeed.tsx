import type { BiodiversityObservationVisual } from '@/modules/biodiversity/biodiversity-visual.types'
import { cn } from '@/shared/utils/cn'

interface BiodiversityRecentObservationsFeedProps {
  observations: BiodiversityObservationVisual[]
  isLoading?: boolean
  onSelect?: (obs: BiodiversityObservationVisual) => void
  className?: string
}

export function BiodiversityRecentObservationsFeed({
  observations,
  isLoading,
  onSelect,
  className,
}: BiodiversityRecentObservationsFeedProps) {
  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-3" />
        ))}
      </div>
    )
  }

  if (observations.length === 0) {
    return (
      <p className={cn('text-sm text-text-secondary', className)}>
        Sin observaciones recientes con imagen en la muestra.
      </p>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {observations.map((obs) => (
        <button
          key={`${obs.source}-${obs.sourceOccurrenceId}`}
          type="button"
          onClick={() => onSelect?.(obs)}
          className="flex w-full gap-3 rounded-lg border border-border-subtle bg-surface-2/50 p-3 text-left hover:bg-surface-2"
        >
          <img
            src={obs.thumbnailUrl}
            alt={obs.commonName ?? obs.taxonName}
            className="h-16 w-16 shrink-0 rounded-md object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text-primary line-clamp-1">
              {obs.commonName ?? obs.taxonName}
            </p>
            <p className="text-xs text-text-secondary line-clamp-1">
              {obs.zoneName} · {obs.taxonomicGroupLabel}
            </p>
            <p className="mt-1 text-[10px] text-text-tertiary">
              {obs.source.toUpperCase()}
              {obs.qualityGrade ? ` · ${obs.qualityGrade}` : ''}
              {obs.observedAt ? ` · ${obs.observedAt.slice(0, 10)}` : ''}
            </p>
          </div>
        </button>
      ))}
    </div>
  )
}
