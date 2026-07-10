import { cn } from '@/shared/utils/cn'
import {
  groupLandCoverDistribution,
  formatLandCoverPercentage,
  type LandCoverDistributionSegment,
} from '@/modules/fires/utils/land-cover-distribution'
import {
  landCoverClassColor,
  LAND_COVER_OTHERS_COLOR,
} from '@/modules/territory/land-cover/land-cover-colors'

export interface LandCoverDistributionBarProps {
  segments: LandCoverDistributionSegment[]
  className?: string
  showLegend?: boolean
  maxClasses?: number
}

function segmentTooltip(segment: LandCoverDistributionSegment): string {
  const parts = [`${segment.label}: ${formatLandCoverPercentage(segment.percentage)}%`]
  if (segment.area_ha != null && segment.area_ha > 0) {
    parts.push(`${segment.area_ha} ha`)
  }
  if (segment.count != null && segment.count > 0) {
    parts.push(`${segment.count} detección${segment.count === 1 ? '' : 'es'}`)
  }
  return parts.join(' · ')
}

export function LandCoverDistributionBar({
  segments,
  className,
  showLegend = true,
  maxClasses = 5,
}: LandCoverDistributionBarProps) {
  const grouped = groupLandCoverDistribution(segments, maxClasses)
  if (grouped.length === 0) {
    return <p className="text-xs text-text-tertiary">Sin datos de distribución.</p>
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-surface-3"
        role="img"
        aria-label="Distribución de cobertura del suelo"
      >
        {grouped.map((segment) => (
          <div
            key={`${segment.class}-${segment.label}`}
            className="h-full min-w-[2px] transition-[width]"
            style={{
              width: `${Math.max(segment.percentage, 0)}%`,
              backgroundColor:
                segment.class === 'others'
                  ? LAND_COVER_OTHERS_COLOR
                  : landCoverClassColor(segment.class),
            }}
            title={segmentTooltip(segment)}
          />
        ))}
      </div>

      {showLegend && (
        <ul className="space-y-1 text-xs text-text-secondary">
          {grouped.map((segment) => (
            <li
              key={`legend-${segment.class}-${segment.label}`}
              className="flex items-center justify-between gap-2"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-sm"
                  style={{
                    backgroundColor:
                      segment.class === 'others'
                        ? LAND_COVER_OTHERS_COLOR
                        : landCoverClassColor(segment.class),
                  }}
                  aria-hidden
                />
                <span className="truncate">{segment.label}</span>
              </span>
              <span className="shrink-0 font-mono text-text-primary">
                {formatLandCoverPercentage(segment.percentage)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
