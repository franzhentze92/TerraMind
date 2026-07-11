import { Link } from 'react-router-dom'
import { useState } from 'react'
import {
  ModuleHeader,
  FilterEmptyState,
  OperationalEmptyState,
  OperationalListSkeleton,
  OperationalErrorState,
} from '@/shared/components'
import { Badge } from '@/shared/components/Badge'
import { useVerificationPlansList } from '../hooks/useVerificationPlans'
import {
  verificationNeedTypeLabel,
  verificationPlanStatusLabel,
} from '../utils/verification-labels'
import { cn } from '@/shared/utils/cn'
import { useCanonicalOperationalCounts } from '@/shared/hooks/useCanonicalOperationalCounts'

export function VerificationsPage() {
  const [status, setStatus] = useState('')
  const query = useVerificationPlansList({ status: status || undefined })
  const counts = useCanonicalOperationalCounts()
  const items = query.data?.items ?? []
  const listEmpty = !query.isLoading && !query.isError && items.length === 0

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6" data-testid="verifications-page">
      <ModuleHeader
        title="Verificaciones"
        description="Planes de verificación derivados de incertidumbres en incidentes activos."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {['', 'ready', 'draft', 'blocked', 'not_required'].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatus(s)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-xs',
              status === s
                ? 'border-accent bg-accent/10 text-text-primary'
                : 'border-border-subtle text-text-tertiary',
            )}
          >
            {s ? verificationPlanStatusLabel(s) : 'Todos'}
          </button>
        ))}
      </div>

      {query.isLoading && <OperationalListSkeleton />}
      {query.isError && (
        <OperationalErrorState
          title="No se pudo cargar la lista de verificaciones"
          explanation="Verifica tu conexión e intenta de nuevo."
          friendlyCode="VER-LIST"
          onRetry={() => void query.refetch()}
        />
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.id}
            to={`/incidentes/${item.incident_id}#verificacion`}
            className="block rounded-lg border border-border-subtle bg-surface-2/30 p-4 hover:border-accent/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                  Incidente · prioridad {item.plan_priority}
                </p>
                <h3 className="text-sm font-semibold text-text-primary">
                  {item.primary_need_type
                    ? verificationNeedTypeLabel(item.primary_need_type)
                    : 'Sin necesidad principal'}
                </h3>
                {item.recommended_method_label && (
                  <p className="mt-1 text-xs text-text-secondary">
                    {item.recommended_method_label}
                    {item.requires_field ? ' · requiere campo' : ' · remoto'}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="default">{verificationPlanStatusLabel(item.status)}</Badge>
                {item.requires_field && <Badge variant="default">Campo</Badge>}
              </div>
            </div>
            <p className="mt-2 text-xs text-text-tertiary">
              {item.needs_count} necesidad(es) · ventana{' '}
              {(item.recommended_window as { end_hours?: number })?.end_hours ?? '—'}h
            </p>
          </Link>
        ))}

        {listEmpty && status === 'not_required' && (
          <OperationalEmptyState
            title="No se requiere verificación adicional"
            explanation="La revisión remota o el contexto actual es suficiente para las preguntas abiertas."
            status="not_required"
          />
        )}
        {listEmpty && status && status !== 'not_required' && (
          <FilterEmptyState resourceLabel="verificaciones" onClearFilters={() => setStatus('')} />
        )}
        {listEmpty && !status && (
          <OperationalEmptyState
            title="No existen preguntas activas de verificación"
            explanation="El sistema no ha identificado incertidumbres que requieran una acción adicional."
            sourceProcess="Incidente → plan de verificación"
            status="not_required"
            supplementalNote={
              counts.verificationPlansLegacy > 0
                ? `Existen ${counts.verificationPlansLegacy} plan(es) legacy pendientes de ownership.`
                : undefined
            }
            primaryAction={{ label: 'Ver incidentes', href: '/incidentes' }}
          />
        )}
      </div>
    </div>
  )
}
