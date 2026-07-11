import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/shared/utils/cn'

export interface OperationalEmptyStateProps {
  icon?: ReactNode
  title: string
  explanation: string
  sourceProcess?: string
  requiredPermission?: string
  primaryCta?: { label: string; to: string }
  secondaryCta?: { label: string; to: string }
  documentationHref?: string
  className?: string
}

/**
 * Standard empty state — explains why a list is empty and what to do next (Phase 2 §11).
 */
export function OperationalEmptyState({
  icon,
  title,
  explanation,
  sourceProcess,
  requiredPermission,
  primaryCta,
  secondaryCta,
  documentationHref,
  className,
}: OperationalEmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border-subtle bg-surface-2/30 px-6 py-8 text-center',
        className,
      )}
    >
      {icon && <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center text-text-tertiary">{icon}</div>}
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">{explanation}</p>
      {sourceProcess && (
        <p className="mt-2 text-xs text-text-tertiary">Origen: {sourceProcess}</p>
      )}
      {requiredPermission && (
        <p className="mt-1 text-xs text-text-tertiary">Permiso requerido: {requiredPermission}</p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {primaryCta && (
          <Link
            to={primaryCta.to}
            className="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:opacity-90"
          >
            {primaryCta.label}
          </Link>
        )}
        {secondaryCta && (
          <Link
            to={secondaryCta.to}
            className="rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
          >
            {secondaryCta.label}
          </Link>
        )}
        {documentationHref && (
          <a
            href={documentationHref}
            className="text-xs text-accent hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Más información
          </a>
        )}
      </div>
    </div>
  )
}
