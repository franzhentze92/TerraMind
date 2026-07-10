import { Link } from 'react-router-dom'
import { useState } from 'react'
import { ModuleHeader } from '@/shared/components'
import { Badge } from '@/shared/components/Badge'
import { useMissionsList } from '../hooks/useMissions'
import { missionStatusLabel, missionTypeLabel } from '../utils/mission-labels'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { cn } from '@/shared/utils/cn'

export function MissionsPage() {
  const [status, setStatus] = useState('')
  const query = useMissionsList({ status: status || undefined })

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <ModuleHeader
        title="Misiones"
        description="Unidades de trabajo derivadas de planes de verificación elegibles."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {['', 'ready', 'in_progress', 'blocked', 'completed'].map((s) => (
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
            {s ? missionStatusLabel(s) : 'Todas'}
          </button>
        ))}
      </div>

      {query.isLoading && <p className="text-sm text-text-tertiary">Cargando misiones…</p>}
      {query.isError && (
        <p className="text-sm text-confidence-low">No se pudo cargar la lista de misiones.</p>
      )}

      <div className="space-y-3">
        {(query.data?.items ?? []).map((item) => (
          <Link
            key={item.id}
            to={`/misiones/${item.id}`}
            className="block rounded-lg border border-border-subtle bg-surface-2/30 p-4 hover:border-accent/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                  {missionTypeLabel(item.mission_type)}
                </p>
                <h3 className="text-sm font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-1 text-xs text-text-tertiary">
                  Incidente {item.incident_id.slice(0, 8)}… · {item.task_count} tarea(s) ·{' '}
                  {item.required_evidence_count} evidencia(s) requerida(s)
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="default">{missionStatusLabel(item.status)}</Badge>
                <Badge variant="default">P{item.priority}</Badge>
              </div>
            </div>
            <p className="mt-2 text-xs text-text-secondary">
              Límite {formatGuatemalaDateTime(item.due_at)} · expira{' '}
              {formatGuatemalaDateTime(item.expires_at)}
            </p>
          </Link>
        ))}
        {(query.data?.items ?? []).length === 0 && !query.isLoading && (
          <p className="text-sm text-text-tertiary">Sin misiones registradas todavía.</p>
        )}
      </div>
    </div>
  )
}
