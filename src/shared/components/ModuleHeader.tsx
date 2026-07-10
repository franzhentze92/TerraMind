import type { ReactNode } from 'react'
import { cn } from '@/shared/utils/cn'

interface ModuleHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function ModuleHeader({ title, description, actions, className }: ModuleHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between border-b border-border-subtle pb-6', className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
