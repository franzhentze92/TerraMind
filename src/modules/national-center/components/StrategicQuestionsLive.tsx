import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { STRATEGIC_QUESTIONS } from '@/intelligence/types/strategic-questions'
import type { StrategicAnswer } from '@/modules/national-center/data/situation.demo'
import { ConfidenceIndicator } from '@/shared/components'
import { cn } from '@/shared/utils/cn'

interface StrategicQuestionsLiveProps {
  answers: StrategicAnswer[]
}

export function StrategicQuestionsLive({ answers }: StrategicQuestionsLiveProps) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-2">
      <div className="border-b border-border-subtle px-4 py-3">
        <h3 className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Análisis estratégico — últimas 24h
        </h3>
      </div>

      <div className="divide-y divide-border-subtle">
        {STRATEGIC_QUESTIONS.map((question, i) => {
          const answer = answers.find((a) => a.questionId === question.id)
          if (!answer) return null

          return (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
              className="group px-4 py-3.5 transition-colors hover:bg-surface-3/30"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">{question.question}</p>
                  <p className="mt-1 text-xs leading-relaxed text-text-tertiary">{answer.summary}</p>
                </div>
                <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 -rotate-90 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100" />
              </div>

              <div className="mt-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'font-mono text-sm font-semibold',
                      answer.count > 0 ? 'text-accent' : 'text-text-tertiary',
                    )}
                  >
                    {answer.count}
                  </span>
                  <span className="text-xs text-text-secondary">{answer.countLabel}</span>
                </div>
                <ConfidenceIndicator level={answer.confidence} showLabel={false} />
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
