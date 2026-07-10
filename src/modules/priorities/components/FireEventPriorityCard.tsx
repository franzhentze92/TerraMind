import { Link } from 'react-router-dom'
import { Badge } from '@/shared/components/Badge'
import type { PriorityDetailDto } from '../api/priorities-api'
import {
  actionLevelLabel,
  attentionLevelLabel,
  verificationLevelLabel,
} from '../utils/priority-labels'

interface FireEventPriorityCardProps {
  assessment?: PriorityDetailDto | null
  isLoading?: boolean
}

export function FireEventPriorityCard({ assessment, isLoading }: FireEventPriorityCardProps) {
  if (isLoading) {
    return <div className="h-20 animate-pulse rounded-lg bg-surface-3" />
  }

  if (!assessment) {
    return (
      <p className="text-sm text-text-tertiary">
        Aún no hay evaluación de prioridad para este evento.
      </p>
    )
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-2/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="warning">{attentionLevelLabel(assessment.attention_level)}</Badge>
          <Badge variant="default">{verificationLevelLabel(assessment.verification_level)}</Badge>
          <Badge variant="default">{actionLevelLabel(assessment.action_level)}</Badge>
        </div>
        <Link to={`/prioridades/${assessment.id}`} className="text-xs text-accent hover:underline">
          Ver detalle
        </Link>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-text-tertiary">Atención</span>
          <p className="font-medium">{assessment.attention_score}</p>
        </div>
        <div>
          <span className="text-text-tertiary">Verificación</span>
          <p className="font-medium">{assessment.verification_score}</p>
        </div>
        <div>
          <span className="text-text-tertiary">Acción</span>
          <p className="font-medium">{assessment.action_score}</p>
        </div>
      </div>
      {assessment.priority_reasons[0] && (
        <p className="mt-2 text-xs text-text-secondary">{assessment.priority_reasons[0]}</p>
      )}
      {assessment.priority_limitations[0] && (
        <p className="mt-1 text-[11px] text-text-tertiary">{assessment.priority_limitations[0]}</p>
      )}
      <p className="mt-2 text-xs text-text-secondary">{assessment.recommended_next_step}</p>
    </div>
  )
}
