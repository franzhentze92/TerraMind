import type { ReactNode } from 'react'
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs'
import { cn } from '@/shared/utils/cn'

interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumbs?: BreadcrumbItem[]
  actions?: ReactNode
  meta?: ReactNode
  updatedAt?: string
  className?: string
}

/**
 * Contextual page header — title, breadcrumb, actions and freshness (Phase 2 §13).
 */
export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  meta,
  updatedAt,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('border-b border-border-subtle pb-6', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} className="mb-3" />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
          {updatedAt && (
            <p className="mt-1 text-xs text-text-tertiary">Actualizado: {updatedAt}</p>
          )}
          {meta && <div className="mt-2 flex flex-wrap gap-2">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
