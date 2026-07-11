import {
  actionLevelDescription,
  actionLevelLabel,
  attentionLevelDescription,
  attentionLevelLabel,
  verificationLevelDescription,
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
    <section className="grid gap-3 md:grid-cols-3" data-testid="priority-score-explanation">
      <ScoreBlock
        title="Atención"
        subtitle="Qué tan relevante es dar seguimiento"
        score={attentionScore}
        level={attentionLevelLabel(attentionLevel)}
        levelMeaning={attentionLevelDescription(attentionLevel)}
        why={dominantReason}
        tone="attention"
      />
      <ScoreBlock
        title="Valor de verificar"
        subtitle="Cuánto ayudaría confirmar el caso"
        score={verificationScore}
        level={verificationLevelLabel(verificationLevel)}
        levelMeaning={verificationLevelDescription(verificationLevel)}
        why="Confirmar persistencia y, si aplica, evidencia de campo."
        tone="verification"
      />
      <ScoreBlock
        title="Preparación operativa"
        subtitle="Qué preparación conviene anticipar"
        score={actionScore}
        level={actionLevelLabel(actionLevel)}
        levelMeaning={actionLevelDescription(actionLevel)}
        why={recommendedNextStep}
        tone="action"
      />
      {limitations.length > 0 && (
        <p className="text-[11px] text-text-tertiary md:col-span-3">
          Limitaciones: {limitations.slice(0, 2).join(' · ')}
        </p>
      )}
    </section>
  )
}

const TONE_BAR: Record<string, string> = {
  attention: 'bg-confidence-medium/70',
  verification: 'bg-accent/70',
  action: 'bg-confidence-high/70',
}

function ScoreBlock({
  title,
  subtitle,
  score,
  level,
  levelMeaning,
  why,
  tone,
}: {
  title: string
  subtitle: string
  score: number
  level: string
  levelMeaning: string
  why: string
  tone: string
}) {
  const value = Math.round(Math.min(100, Math.max(0, score)))
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1/30 p-3">
      <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{title}</p>
      <p className="text-[11px] text-text-tertiary">{subtitle}</p>
      <p className="mt-1 text-2xl font-semibold text-text-primary">
        {value}
        <span className="text-sm font-normal text-text-tertiary"> / 100</span>
      </p>
      <p className="text-sm font-medium text-text-secondary">{level}</p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full ${TONE_BAR[tone] ?? 'bg-accent/70'}`} style={{ width: `${value}%` }} />
      </div>
      <p className="mt-2 text-xs text-text-secondary">{levelMeaning}</p>
      <p className="mt-1 text-[11px] text-text-tertiary">{why}</p>
    </div>
  )
}
