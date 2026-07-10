import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, FileText } from 'lucide-react'
import type { ExecutiveBrief } from '../data/daily-brief.demo'
import { cn } from '@/shared/utils/cn'

interface ExecutiveSummaryCardProps {
  brief: ExecutiveBrief
}

function SituationList({
  items,
  emoji,
  label,
}: {
  items: { id: string; titulo: string }[]
  emoji: string
  label: string
}) {
  if (items.length === 0) return null

  return (
    <div className="mt-4">
      <p className="text-xs font-medium text-text-secondary">
        {emoji} {label}
      </p>
      <ol className="mt-2 space-y-1.5">
        {items.map((item, i) => (
          <li key={item.id} className="flex gap-2 text-sm text-text-primary">
            <span className="font-mono text-xs text-text-tertiary">{i + 1}.</span>
            {item.titulo}
          </li>
        ))}
      </ol>
    </div>
  )
}

export function ExecutiveSummaryCard({ brief }: ExecutiveSummaryCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-text-tertiary" />
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Resumen ejecutivo
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-border-subtle bg-surface-2/80 p-6">
        <p className="text-base font-medium text-text-primary">{brief.greeting}</p>
        <p className="mt-3 text-sm text-text-secondary">
          Hoy TerraMind identificó{' '}
          <span className="font-semibold text-text-primary">
            {brief.situacionesPrioritarias} situaciones prioritarias
          </span>
          .
        </p>

        <SituationList items={brief.criticas} emoji="🔴" label="Críticas" />
        <SituationList items={brief.atencion} emoji="🟡" label="Atención" />
        <SituationList items={brief.positivos} emoji="🟢" label="Positivo" />

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-5 border-t border-border-subtle pt-5">
                <p className="text-sm leading-relaxed text-text-secondary">
                  {brief.fullAnalysis}
                </p>
                <ul className="mt-4 space-y-1.5 text-xs text-text-tertiary">
                  <li>✓ {brief.stats.sources} fuentes · {brief.stats.observations} observaciones</li>
                  <li>✓ {brief.stats.events} eventos · {brief.stats.hallazgos} hallazgos</li>
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'mt-5 flex items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:text-text-primary',
          )}
        >
          {expanded ? 'Ocultar análisis' : 'Ver análisis completo'}
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
          />
        </button>
      </div>
    </motion.div>
  )
}
