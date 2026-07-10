import { motion } from 'framer-motion'
import type { TopFinding } from '@/modules/national-center/data/situation.demo'
import { Badge } from '@/shared/components'
import { confidenceColor } from '@/intelligence/confidence'

interface TopFindingPanelProps {
  finding: TopFinding
}

export function TopFindingPanel({ finding }: TopFindingPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15 }}
      className="rounded-lg border border-border-default bg-surface-2"
    >
      <div className="border-b border-border-subtle px-5 py-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Top hallazgo del día
        </p>
      </div>

      <div className="p-5">
        <h2 className="text-lg font-semibold leading-snug text-text-primary">{finding.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">{finding.description}</p>

        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between rounded-md bg-surface-3 px-4 py-3">
            <span className="text-xs text-text-secondary">Confianza</span>
            <span className={`font-mono text-lg font-semibold ${confidenceColor(finding.confidence)}`}>
              {finding.confidencePercent}%
            </span>
          </div>

          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Fuentes</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {finding.sources.map((source) => (
                <Badge key={source} variant="default">{source}</Badge>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-1">
            <FindingField label="Hipótesis" value={finding.hypothesis} />
            <FindingField label="Impacto" value={finding.impact} />
            <FindingField label="Recomendación" value={finding.recommendation} highlight />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function FindingField({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className={`rounded-md border px-4 py-3 ${highlight ? 'border-accent/30 bg-accent-subtle/50' : 'border-border-subtle bg-surface-3/50'}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className={`mt-1 text-sm ${highlight ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
        {value}
      </p>
    </div>
  )
}
