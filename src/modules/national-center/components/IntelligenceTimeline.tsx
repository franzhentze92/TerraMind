import { motion } from 'framer-motion'
import type { TimelineEvent } from '@/modules/national-center/data/situation.demo'
import { cn } from '@/shared/utils/cn'

interface IntelligenceTimelineProps {
  events: TimelineEvent[]
}

const TYPE_COLORS: Record<TimelineEvent['type'], string> = {
  data: 'bg-status-info',
  analysis: 'bg-accent',
  confirmation: 'bg-confidence-high',
  report: 'bg-confidence-medium',
  strategy: 'bg-status-warning',
}

export function IntelligenceTimeline({ events }: IntelligenceTimelineProps) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-2">
      <div className="border-b border-border-subtle px-5 py-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Línea de inteligencia
        </p>
      </div>

      <div className="p-5">
        <div className="relative space-y-0">
          {events.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.3 }}
              className="relative flex gap-4 pb-5 last:pb-0"
            >
              {i < events.length - 1 && (
                <div className="absolute left-[5px] top-3 h-full w-px bg-border-default" />
              )}

              <div className="relative z-10 mt-1.5 flex flex-col items-center">
                <span className={cn('h-2.5 w-2.5 rounded-full', TYPE_COLORS[event.type])} />
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <p className="font-mono text-xs text-text-tertiary">{event.time}</p>
                <p className="mt-0.5 text-sm text-text-secondary">{event.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
