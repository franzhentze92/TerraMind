import { motion } from 'framer-motion'
import type { MorningBriefStats } from '@/modules/national-center/data/situation.demo'

interface MorningBriefingProps {
  stats: MorningBriefStats
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export function MorningBriefing({ stats }: MorningBriefingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-lg border border-border-subtle bg-surface-2 p-5"
    >
      <p className="text-base font-medium text-text-primary">{getGreeting()}.</p>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        Durante las últimas 24 horas analizamos:
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-text-secondary">
        <li className="flex items-baseline gap-2">
          <span className="font-mono text-text-primary">{stats.pixelsAnalyzed}</span>
          <span>de píxeles satelitales</span>
        </li>
        <li className="flex items-baseline gap-2">
          <span className="font-mono text-text-primary">{stats.officialSources}</span>
          <span>fuentes oficiales</span>
        </li>
        <li className="flex items-baseline gap-2">
          <span className="font-mono text-text-primary">{stats.variables}</span>
          <span>variables ambientales</span>
        </li>
        <li className="flex items-baseline gap-2">
          <span className="font-mono text-text-primary">{stats.climateModels}</span>
          <span>modelos climáticos</span>
        </li>
      </ul>
      <p className="mt-4 text-sm text-text-secondary">
        Encontramos{' '}
        <span className="font-semibold text-status-warning">
          {stats.situationsRequiringAttention} situaciones que requieren atención
        </span>
        .
      </p>
    </motion.div>
  )
}
