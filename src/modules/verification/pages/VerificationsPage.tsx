import { Link } from 'react-router-dom'
import { useState } from 'react'
import { ModuleHeader } from '@/shared/components'
import { Badge } from '@/shared/components/Badge'
import { useVerificationPlansList } from '../hooks/useVerificationPlans'
import {
  verificationNeedTypeLabel,
  verificationPlanStatusLabel,
} from '../utils/verification-labels'
import { cn } from '@/shared/utils/cn'

export function VerificationsPage() {
  const [status, setStatus] = useState('')
  const query = useVerificationPlansList({ status: status || undefined })

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
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

      {query.isLoading && <p className="text-sm text-text-tertiary">Cargando verificaciones…</p>}
      {query.isError && (
        <p className="text-sm text-confidence-low">No se pudo cargar la lista de verificaciones.</p>
      )}

      <div className="space-y-3">
        {(query.data?.items ?? []).map((item) => (
          <Link
            key={item.id}
            to={`/incidentes/${item.incident_id}`}
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
                {item.requires_external_provider && (
                  <Badge variant="default">Proveedor externo</Badge>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-text-tertiary">
              {item.needs_count} necesidad(es) · ventana{' '}
              {(item.recommended_window as { end_hours?: number })?.end_hours ?? '—'}h
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
