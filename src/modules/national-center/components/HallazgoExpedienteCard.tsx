import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  ArrowDown,
  FileSearch,
  FlaskConical,
  MapPin,
  Target,
} from 'lucide-react'
import type { HallazgoExpediente } from '../data/daily-brief.demo'
import { cn } from '@/shared/utils/cn'

interface HallazgoExpedienteCardProps {
  hallazgo: HallazgoExpediente
  index: number
}

const PRIORITY_STYLES = {
  critica: { label: 'Crítica', className: 'bg-status-critical/10 text-status-critical border-status-critical/20' },
  alta: { label: 'Alta', className: 'bg-status-warning/10 text-status-warning border-status-warning/20' },
  media: { label: 'Media', className: 'bg-accent-subtle text-accent border-accent-muted/30' },
  baja: { label: 'Baja', className: 'bg-surface-4 text-text-tertiary border-border-default' },
} as const

const IMPACTO_COLORS = {
  Bajo: 'text-confidence-high',
  Medio: 'text-status-warning',
  Alto: 'text-status-warning',
  Crítico: 'text-status-critical',
} as const

export function HallazgoExpedienteCard({ hallazgo, index }: HallazgoExpedienteCardProps) {
  const priority = PRIORITY_STYLES[hallazgo.prioridad]

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.08, duration: 0.4 }}
      className="group rounded-xl border border-border-subtle bg-surface-2/60 transition-colors hover:border-border-default hover:bg-surface-2"
    >
      <div className="border-b border-border-subtle px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-4 font-mono text-xs font-semibold text-text-secondary">
              {hallazgo.rank}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-medium', priority.className)}>
                  {priority.label}
                </span>
                <span className="font-mono text-[10px] text-text-tertiary">#{hallazgo.codigo}</span>
              </div>
              <h3 className="mt-1.5 text-sm font-semibold leading-snug text-text-primary">
                {hallazgo.titulo}
              </h3>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="font-mono text-lg font-semibold text-confidence-high">{hallazgo.confianza}%</p>
            <p className="text-[10px] text-text-tertiary">confianza</p>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-text-secondary">{hallazgo.descripcion}</p>
      </div>

      <div className="grid gap-px bg-border-subtle sm:grid-cols-2">
        <MetaItem icon={MapPin} label="Territorio" value={hallazgo.territorio} />
        <MetaItem icon={FlaskConical} label="Hipótesis" value={hallazgo.hipotesis} />
        <MetaItem icon={AlertTriangle} label="Riesgo actual" value={hallazgo.riesgo} />
        <MetaItem icon={Target} label="Estrategia" value={hallazgo.estrategia} highlight />
      </div>

      {/* Consecuencia */}
      <div className="border-t border-border-subtle bg-surface-3/30 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Si no cambia la tendencia
        </p>
        <div className="mt-2 flex items-start gap-2">
          <ArrowDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
          <div>
            <p className="text-xs text-text-secondary">{hallazgo.consecuencia}</p>
            <p className="mt-2 text-[10px] text-text-tertiary">
              Impacto esperado ·{' '}
              <span className={cn('font-semibold', IMPACTO_COLORS[hallazgo.impactoEsperado])}>
                {hallazgo.impactoEsperado}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex flex-wrap gap-1.5">
          {hallazgo.evidencias.map((ev) => (
            <span
              key={ev}
              className="rounded bg-surface-4 px-2 py-0.5 text-[10px] text-text-tertiary"
            >
              {ev}
            </span>
          ))}
        </div>

        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
        >
          <FileSearch className="h-3.5 w-3.5" />
          Ver expediente
          <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      </div>
    </motion.article>
  )
}

function MetaItem({
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  icon: typeof MapPin
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className={cn('bg-surface-2/60 px-4 py-3', highlight && 'bg-accent-subtle/30')}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-text-tertiary" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          {label}
        </span>
      </div>
      <p className={cn('mt-1 text-xs', highlight ? 'font-medium text-text-primary' : 'text-text-secondary')}>
        {value}
      </p>
    </div>
  )
}
