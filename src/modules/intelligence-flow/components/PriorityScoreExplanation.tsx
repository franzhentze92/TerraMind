import {
  actionLevelLabel,
  attentionLevelLabel,
  verificationLevelLabel,
} from '@/modules/priorities/utils/priority-labels'

interface PriorityScoreExplanationProps {
  attentionScore: number
  verificationScore: number
  actionScore: number
  attentionLevel: string
  verificationLevel: string
  actionLevel: string
  reasons: string[]
  recommendedNextStep: string
  limitations?: string[]
}

export function PriorityScoreExplanation({
  attentionScore,
  verificationScore,
  actionScore,
  attentionLevel,
  verificationLevel,
  actionLevel,
  reasons,
  recommendedNextStep,
  limitations = [],
}: PriorityScoreExplanationProps) {
  const dominantReason = reasons[0] ?? 'Sin factores dominantes registrados'

  return (
    <section className="space-y-4" data-testid="priority-score-explanation">
      <ScoreBlock
        title="Atención"
        score={attentionScore}
        level={attentionLevelLabel(attentionLevel)}
        why={`Por qué: ${dominantReason}`}
        next="Revisar en mapa y cola de prioridades"
      />
      <ScoreBlock
        title="Verificación"
        score={verificationScore}
        level={verificationLevelLabel(verificationLevel)}
        why="Qué falta: confirmar persistencia y evidencia de campo si aplica"
        next="Revisar plan de verificación del incidente"
      />
      <ScoreBlock
        title="Acción"
        score={actionScore}
        level={actionLevelLabel(actionLevel)}
        why={`Siguiente paso operativo: ${recommendedNextStep}`}
        next={recommendedNextStep}
      />
      {limitations.length > 0 && (
        <p className="text-[11px] text-text-tertiary">
          Limitaciones: {limitations.slice(0, 2).join(' · ')}
        </p>
      )}
    </section>
  )
}

function ScoreBlock({
  title,
  score,
  level,
  why,
  next,
}: {
  title: string
  score: number
  level: string
  why: string
  next: string
}) {
  const pct = Math.min(100, Math.max(0, score))
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1/30 p-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{title}</p>
          <p className="text-xl font-semibold text-text-primary">
            {score.toFixed(1)}{' '}
            <span className="text-sm font-normal text-text-secondary">— {level}</span>
          </p>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-accent/70" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-text-secondary">{why}</p>
      <p className="mt-1 text-[11px] text-text-tertiary">{next}</p>
    </div>
  )
}
