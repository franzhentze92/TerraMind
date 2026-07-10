import type { ReactNode } from 'react'
import { cn } from '@/shared/utils/cn'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  className?: string
}

export function EmptyState({ icon, title, description, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      {icon && <div className="mb-4 text-text-tertiary">{icon}</div>}
      <h3 className="text-sm font-medium text-text-primary">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-text-secondary">{description}</p>
    </div>
  )
}
