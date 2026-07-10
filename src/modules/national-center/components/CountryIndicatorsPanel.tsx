import { motion } from 'framer-motion'
import type { CountryIndicator } from '../data/daily-brief.demo'
import { cn } from '@/shared/utils/cn'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'

interface CountryIndicatorsPanelProps {
  indicators: CountryIndicator[]
}

const STATUS_COLORS = {
  good: 'text-confidence-high',
  warning: 'text-status-warning',
  critical: 'text-status-critical',
} as const

const LEVEL_COLORS: Record<CountryIndicator['level'], string> = {
  BAJO: 'text-confidence-high',
  NORMAL: 'text-text-secondary',
  ALTO: 'text-status-warning',
  CRÍTICO: 'text-status-critical',
}

const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
} as const

function ScoreBar({ score, status, max = 100 }: { score: number; status: CountryIndicator['status']; max?: number }) {
  const barColor =
    status === 'good'
      ? 'bg-confidence-high'
      : status === 'warning'
        ? 'bg-status-warning'
        : 'bg-status-critical'

  const width = Math.min(100, Math.max(0, (score / max) * 100))

  return (
    <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-surface-4">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${width}%` }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        className={cn('h-full rounded-full', barColor)}
      />
    </div>
  )
}

export function CountryIndicatorsPanel({ indicators }: CountryIndicatorsPanelProps) {
  return (
    <div className="space-y-1">
      <p className="mb-4 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
        Estado del país
      </p>

      {indicators.map((ind, i) => {
        const isFireLive = ind.id === 'fire' && ind.subtitle
        const TrendIcon = isFireLive ? null : TREND_ICONS[ind.trend]
        const changePrefix = ind.change7d > 0 ? '+' : ''
        const scoreMax = isFireLive ? Math.max(ind.score, 10) : 100

        return (
          <motion.div
            key={ind.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.06 }}
            className={cn(
              'rounded-lg border border-border-subtle bg-surface-2/50 px-4 py-3',
              isFireLive && 'border-confidence-medium/30',
            )}
          >
            <span className="text-xs text-text-secondary">{ind.label}</span>

            <div className="mt-1.5 flex items-end justify-between">
              <div className="flex items-baseline gap-1">
                <span className={cn('font-mono text-2xl font-semibold', STATUS_COLORS[ind.status])}>
                  {ind.score}
                </span>
                <span className={cn('text-[10px] font-medium', LEVEL_COLORS[ind.level])}>
                  {isFireLive ? (ind.contextLabel ?? ind.level) : ind.level}
                </span>
              </div>
              {isFireLive ? (
                <span className="text-[10px] text-text-tertiary">{ind.subtitle}</span>
              ) : TrendIcon ? (
                <div className="flex items-center gap-1 text-right">
                  <TrendIcon className={cn('h-3 w-3', STATUS_COLORS[ind.status])} />
                  <span className={cn('font-mono text-xs', STATUS_COLORS[ind.status])}>
                    {changePrefix}{ind.change7d}
                  </span>
                </div>
              ) : null}
            </div>

            <p className="mt-1 text-[10px] text-text-tertiary">
              {isFireLive ? 'Eventos térmicos' : 'Últimos 7 días'}
            </p>
            <ScoreBar score={ind.score} status={ind.status} max={scoreMax} />
          </motion.div>
        )
      })}
    </div>
  )
}
