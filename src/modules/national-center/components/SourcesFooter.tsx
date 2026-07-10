import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DataSource } from '../data/daily-brief.demo'
import { cn } from '@/shared/utils/cn'

interface SourcesFooterProps {
  sources: DataSource[]
}

const STATUS_DOT = {
  connected: 'bg-confidence-high',
  syncing: 'bg-accent animate-pulse',
  degraded: 'bg-status-warning',
  offline: 'bg-text-tertiary',
} as const

const STATUS_LABEL = {
  connected: 'Conectado',
  syncing: 'Sincronizando',
  degraded: 'Degradado',
  offline: 'Desconectado',
} as const

export function SourcesFooter({ sources }: SourcesFooterProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = sources.find((s) => s.id === activeId)

  return (
    <footer className="relative shrink-0 border-t border-border-subtle bg-surface-1/40">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Fuentes hoy
        </p>

        {sources.map((source) => (
          <button
            key={source.id}
            type="button"
            onClick={() => setActiveId(activeId === source.id ? null : source.id)}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1 transition-colors',
              activeId === source.id
                ? 'bg-surface-3 text-text-primary'
                : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[source.status])} />
            <span className="text-xs">{source.name}</span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-border-subtle bg-surface-2/50"
          >
            <div className="grid gap-4 px-6 py-4 sm:grid-cols-4">
              <Detail label="Última actualización" value={active.lastSync ?? '—'} mono />
              <Detail label="Tiempo promedio" value={active.avgLatency ?? '—'} mono />
              <Detail label="Estado" value={STATUS_LABEL[active.status]} />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-text-tertiary">
                  Variables obtenidas
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {active.variables.map((v) => (
                    <span
                      key={v}
                      className="rounded bg-surface-4 px-1.5 py-0.5 text-[10px] text-text-secondary"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </footer>
  )
}

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className={cn('mt-1 text-sm text-text-primary', mono && 'font-mono')}>{value}</p>
    </div>
  )
}
