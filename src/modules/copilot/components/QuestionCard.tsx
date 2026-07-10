import type { StrategicQuestion } from '@/intelligence/types'
import { cn } from '@/shared/utils/cn'

interface QuestionCardProps {
  question: StrategicQuestion
  isActive: boolean
  onSelect: () => void
}

export function QuestionCard({ question, isActive, onSelect }: QuestionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg border p-4 text-left transition-colors',
        isActive
          ? 'border-accent/40 bg-accent-subtle'
          : 'border-border-subtle bg-surface-2 hover:border-border-default hover:bg-surface-3',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold',
            isActive ? 'bg-accent text-text-inverse' : 'bg-surface-4 text-text-tertiary',
          )}
        >
          {question.order}
        </span>
        <div className="min-w-0">
          <p className={cn('text-sm font-medium', isActive ? 'text-text-primary' : 'text-text-secondary')}>
            {question.question}
          </p>
          <p className="mt-1 text-xs text-text-tertiary">{question.description}</p>
        </div>
      </div>
    </button>
  )
}
