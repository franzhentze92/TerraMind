import { STRATEGIC_QUESTIONS } from '@/intelligence/types/strategic-questions'
import { useTerritoryStore } from '@/core/config/territory.store'
import { DEMO_STRATEGIC_ANSWERS } from '@/modules/national-center/data/situation.demo'
import { ConfidenceIndicator } from '@/shared/components'
import { cn } from '@/shared/utils/cn'

export function CopilotPage() {
  const territory = useTerritoryStore((s) => s.territory)

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-border-subtle px-6 py-5">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Análisis profundo
        </p>
        <h1 className="mt-1 text-xl font-semibold text-text-primary">
          Motor de razonamiento — {territory.countryName}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Exploración detallada de las cinco preguntas estratégicas con evidencia completa.
        </p>
      </div>

      <div className="space-y-4 p-6">
        {STRATEGIC_QUESTIONS.map((question) => {
          const answer = DEMO_STRATEGIC_ANSWERS.find((a) => a.questionId === question.id)
          return (
            <div
              key={question.id}
              className="rounded-lg border border-border-subtle bg-surface-2 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-text-primary">{question.question}</p>
                  <p className="mt-1 text-xs text-text-tertiary">{question.description}</p>
                </div>
                {answer && <ConfidenceIndicator level={answer.confidence} />}
              </div>

              {answer && (
                <div className="mt-4 rounded-md bg-surface-3/50 px-4 py-3">
                  <p className="text-sm text-text-secondary">{answer.summary}</p>
                  <p className="mt-2 text-xs text-text-tertiary">
                    <span className={cn('font-mono font-semibold text-accent')}>{answer.count}</span>
                    {' '}{answer.countLabel}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
