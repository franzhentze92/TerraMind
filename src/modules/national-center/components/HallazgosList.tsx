import type { HallazgoExpediente } from '../data/daily-brief.demo'
import { HallazgoExpedienteCard } from './HallazgoExpedienteCard'

interface HallazgosListProps {
  hallazgos: HallazgoExpediente[]
}

export function HallazgosList({ hallazgos }: HallazgosListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Top {hallazgos.length} hallazgos nacionales
        </p>
        <span className="text-[10px] text-text-tertiary">Ordenados por prioridad</span>
      </div>

      <div className="space-y-3">
        {hallazgos.map((h, i) => (
          <HallazgoExpedienteCard key={h.id} hallazgo={h} index={i} />
        ))}
      </div>
    </div>
  )
}
