import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, Clock } from 'lucide-react'
import type { ActivityEvent } from '@/modules/national-center/data/situation.demo'
import { cn } from '@/shared/utils/cn'

interface LiveActivityFeedProps {
  events: ActivityEvent[]
}

const STATUS_ICON = {
  completed: Check,
  processing: Loader2,
  queued: Clock,
}

const STATUS_STYLE = {
  completed: 'text-confidence-high',
  processing: 'text-accent animate-spin',
  queued: 'text-text-tertiary',
}

export function LiveActivityFeed({ events }: LiveActivityFeedProps) {
  const [visibleEvents, setVisibleEvents] = useState<ActivityEvent[]>(events.slice(0, 5))

  useEffect(() => {
    let index = 5
    const interval = setInterval(() => {
      if (index < events.length) {
        setVisibleEvents((prev) => [events[index], ...prev].slice(0, 6))
        index++
      } else {
        index = 0
        setVisibleEvents(events.slice(0, 5))
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [events])

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-2">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h3 className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Actividad en tiempo real
        </h3>
        <span className="flex items-center gap-1.5 text-[10px] text-confidence-high">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-confidence-high" />
          En vivo
        </span>
      </div>

      <div className="max-h-[220px] overflow-hidden p-2">
        <AnimatePresence initial={false}>
          {visibleEvents.map((event) => {
            const Icon = STATUS_ICON[event.status]
            return (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0, x: -12, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-surface-3/50"
              >
                <Icon className={cn('h-3.5 w-3.5 shrink-0', STATUS_STYLE[event.status])} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-text-primary">{event.source}</p>
                  <p className="truncate text-xs text-text-tertiary">{event.message}</p>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
