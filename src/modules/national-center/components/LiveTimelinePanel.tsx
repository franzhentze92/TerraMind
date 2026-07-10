import { motion } from 'framer-motion'
import { Check, Loader2, Clock } from 'lucide-react'
import type { TimelineEntry, TimelineStatus } from '../data/daily-brief.demo'
import { cn } from '@/shared/utils/cn'

interface LiveTimelinePanelProps {
  entries: TimelineEntry[]
  live?: boolean
}

const STATUS_CONFIG: Record<
  TimelineStatus,
  { icon: typeof Check; label: string; className: string }
> = {
  processed: { icon: Check, label: 'Procesado', className: 'text-confidence-high' },
  analyzing: { icon: Loader2, label: 'Analizando', className: 'text-status-warning animate-spin' },
  waiting: { icon: Clock, label: 'Esperando', className: 'text-status-info' },
}

export function LiveTimelinePanel({ entries, live = false }: LiveTimelinePanelProps) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Línea de inteligencia
        </p>
        <span className="flex items-center gap-1.5 text-[10px] text-confidence-high">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-confidence-high opacity-50" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-confidence-high" />
          </span>
          {live ? 'Pipeline FIRMS' : 'En vivo'}
        </span>
      </div>

      <div className="relative space-y-0">
        <div className="absolute bottom-2 left-[5px] top-2 w-px bg-border-default" />

        {entries.map((entry, i) => {
          const status = STATUS_CONFIG[entry.status]
          const Icon = status.icon

          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative flex gap-3 pb-4 last:pb-0"
            >
              <div className="relative z-10 mt-1.5">
                <span
                  className={cn(
                    'block h-2.5 w-2.5 rounded-full border-2 border-surface-1',
                    entry.status === 'analyzing' ? 'bg-status-warning animate-pulse' : 'bg-border-strong',
                  )}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[11px] text-text-tertiary">{entry.time}</p>
                  <div className={cn('flex items-center gap-1', status.className)}>
                    <Icon className="h-3 w-3" />
                    <span className="text-[10px]">{status.label}</span>
                  </div>
                </div>
                <p className="mt-0.5 text-xs leading-snug text-text-secondary">{entry.label}</p>
                {entry.source && (
                  <p className="mt-0.5 text-[10px] text-text-tertiary">{entry.source}</p>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
