import type { ConfidenceLevel } from '@/intelligence/types'
import { confidenceColor, confidenceLabel } from '@/intelligence/confidence'
import { cn } from '@/shared/utils/cn'

interface ConfidenceIndicatorProps {
  level: ConfidenceLevel
  showLabel?: boolean
  className?: string
}

const dotColors: Record<ConfidenceLevel, string> = {
  high: 'bg-confidence-high',
  medium: 'bg-confidence-medium',
  low: 'bg-confidence-low',
  insufficient: 'bg-text-tertiary',
}

export function ConfidenceIndicator({ level, showLabel = true, className }: ConfidenceIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className={cn('h-2 w-2 rounded-full', dotColors[level])} />
      {showLabel && (
        <span className={cn('text-xs font-medium', confidenceColor(level))}>
          {confidenceLabel(level)}
        </span>
      )}
    </div>
  )
}
