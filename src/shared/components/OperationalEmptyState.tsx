import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/shared/utils/cn'

export type OperationalEmptyStatus =
  | 'empty'
  | 'pending'
  | 'blocked'
  | 'not_required'
  | 'permission_denied'

export interface OperationalEmptyAction {
  label: string
  href?: string
  onClick?: () => void
}

export interface OperationalEmptyStateProps {
  icon?: ReactNode
  title: string
  explanation: string
  sourceProcess?: string
  nextExpectedEvent?: string
  requiredPermission?: string
  /** @deprecated use primaryAction */
  primaryCta?: { label: string; to: string }
  /** @deprecated use secondaryAction */
  secondaryCta?: { label: string; to: string }
  primaryAction?: OperationalEmptyAction
  secondaryAction?: OperationalEmptyAction
  documentationHref?: string
  status?: OperationalEmptyStatus
  compact?: boolean
  supplementalNote?: string
  className?: string
}

const STATUS_BORDER: Record<OperationalEmptyStatus, string> = {
  empty: 'border-border-subtle bg-surface-2/30',
  pending: 'border-amber-500/25 bg-amber-500/5',
  blocked: 'border-border-subtle bg-surface-2/20',
  not_required: 'border-border-subtle bg-surface-2/20',
  permission_denied: 'border-red-500/25 bg-red-500/5',
}

/**
 * Standard empty state — explains why a list is empty and what to do next (Phase 2 §11, Phase 5).
 */
export function OperationalEmptyState({
  icon,
  title,
  explanation,
  sourceProcess,
  nextExpectedEvent,
  requiredPermission,
  primaryCta,
  secondaryCta,
  primaryAction,
  secondaryAction,
  documentationHref,
  status = 'empty',
  compact = false,
  supplementalNote,
  className,
}: OperationalEmptyStateProps) {
  const primary = primaryAction ?? (primaryCta ? { label: primaryCta.label, href: primaryCta.to } : undefined)
  const secondary =
    secondaryAction ?? (secondaryCta ? { label: secondaryCta.label, href: secondaryCta.to } : undefined)

  return (
    <div
      className={cn(
        'rounded-xl border text-center',
        STATUS_BORDER[status],
        compact ? 'px-4 py-5' : 'px-6 py-8',
        className,
      )}
      data-testid="operational-empty-state"
      data-empty-status={status}
    >
      {icon && (
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center text-text-tertiary">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">{explanation}</p>
      {sourceProcess && (
        <p className="mt-2 text-xs text-text-tertiary">Se alimenta desde: {sourceProcess}</p>
      )}
      {nextExpectedEvent && (
        <p className="mt-1 text-xs text-text-tertiary">Próximo paso esperado: {nextExpectedEvent}</p>
      )}
      {requiredPermission && (
        <p className="mt-1 text-xs text-text-tertiary">Permiso requerido: {requiredPermission}</p>
      )}
      {supplementalNote && (
        <p className="mx-auto mt-2 max-w-md text-xs text-text-tertiary">{supplementalNote}</p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {primary && <EmptyActionButton action={primary} variant="primary" />}
        {secondary && <EmptyActionButton action={secondary} variant="secondary" />}
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

function EmptyActionButton({
  action,
  variant,
}: {
  action: OperationalEmptyAction
  variant: 'primary' | 'secondary'
}) {
  const className =
    variant === 'primary'
      ? 'rounded-lg bg-accent px-4 py-2 text-sm text-white hover:opacity-90'
      : 'rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-secondary hover:text-text-primary'

  if (action.href) {
    return (
      <Link to={action.href} className={className}>
        {action.label}
      </Link>
    )
  }
  if (action.onClick) {
    return (
      <button type="button" onClick={action.onClick} className={className}>
        {action.label}
      </button>
    )
  }
  return null
}

export function PermissionDeniedState({ className }: { className?: string }) {
  return (
    <OperationalEmptyState
      status="permission_denied"
      title="No tienes permiso para ver esta información."
      explanation="Solicita acceso a un administrador de la organización si necesitas esta vista."
      className={className}
    />
  )
}

export function FeatureDisabledState({
  title = 'Esta función no está habilitada para tu organización.',
  explanation = 'Contacta al administrador si crees que deberías tener acceso.',
  className,
}: {
  title?: string
  explanation?: string
  className?: string
}) {
  return (
    <OperationalEmptyState
      status="blocked"
      title={title}
      explanation={explanation}
      className={className}
    />
  )
}

export function FilterEmptyState({
  resourceLabel,
  onClearFilters,
  className,
}: {
  resourceLabel: string
  onClearFilters: () => void
  className?: string
}) {
  return (
    <OperationalEmptyState
      title={`No hay ${resourceLabel} que coincidan con estos filtros`}
      explanation="Prueba ampliar los criterios o restablecer los filtros."
      status="empty"
      primaryAction={{ label: 'Limpiar filtros', onClick: onClearFilters }}
      className={className}
    />
  )
}
