import { useState } from 'react'
import { cn } from '@/shared/utils/cn'
import { useHasPermission } from '@/core/auth/AuthProvider'

export interface OperationalErrorStateProps {
  title: string
  explanation: string
  friendlyCode?: string
  onRetry?: () => void
  supportHref?: string
  technicalDetail?: string
  className?: string
}

export function OperationalErrorState({
  title,
  explanation,
  friendlyCode,
  onRetry,
  supportHref,
  technicalDetail,
  className,
}: OperationalErrorStateProps) {
  const [showTechnical, setShowTechnical] = useState(false)
  const isAdmin = useHasPermission('platform.admin')

  return (
    <div
      className={cn(
        'rounded-xl border border-red-500/30 bg-red-500/5 px-6 py-8 text-center',
        className,
      )}
      data-testid="operational-error-state"
    >
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">{explanation}</p>
      {friendlyCode && (
        <p className="mt-2 text-xs text-text-tertiary">Referencia: {friendlyCode}</p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:opacity-90"
          >
            Reintentar
          </button>
        )}
        {supportHref && (
          <a
            href={supportHref}
            className="rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
          >
            Contactar soporte
          </a>
        )}
      </div>
      {isAdmin && technicalDetail && (
        <div className="mt-4 text-left">
          <button
            type="button"
            className="text-xs text-text-tertiary hover:text-text-secondary"
            onClick={() => setShowTechnical((v) => !v)}
          >
            {showTechnical ? 'Ocultar detalle técnico' : 'Ver detalle técnico'}
          </button>
          {showTechnical && (
            <pre className="mt-2 max-h-40 overflow-auto rounded border border-border-subtle bg-surface-1 p-2 text-left text-[10px] text-text-tertiary">
              {technicalDetail}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
