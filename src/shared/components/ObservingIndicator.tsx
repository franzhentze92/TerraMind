import { motion, AnimatePresence } from 'framer-motion'
import { useTerritoryStore } from '@/core/config/territory.store'
import { OBSERVING_SOURCES, OBSERVING_ACTIONS } from '@/modules/national-center/data/situation.demo'
import { useCyclingIndex } from '@/shared/hooks/useLiveClock'

export function ObservingIndicator() {
  const territory = useTerritoryStore((s) => s.territory)
  const sourceIndex = useCyclingIndex(OBSERVING_SOURCES.length, 2400)
  const actionIndex = useCyclingIndex(OBSERVING_ACTIONS.length, 1800)

  return (
    <div className="flex items-center gap-3 font-mono text-xs">
      <span className="flex items-center gap-1.5 text-confidence-high">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-confidence-high opacity-40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-confidence-high" />
        </span>
        Observando {territory.countryName}
      </span>

      <span className="text-border-strong">|</span>

      <div className="flex min-w-[200px] items-center gap-1.5 overflow-hidden text-text-secondary">
        <AnimatePresence mode="wait">
          <motion.span
            key={`${sourceIndex}-${actionIndex}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="truncate"
          >
            <span className="text-text-primary">{OBSERVING_SOURCES[sourceIndex]}</span>
            <span className="text-text-tertiary"> · </span>
            <span>{OBSERVING_ACTIONS[actionIndex]}…</span>
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  )
}
