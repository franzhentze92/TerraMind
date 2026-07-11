import { Link } from 'react-router-dom'
import { useState } from 'react'
import { ModuleHeader } from '@/shared/components'
import { Badge } from '@/shared/components/Badge'
import { useIncidentsList } from '../hooks/useIncidents'
import {
  evidenceStatusLabel,
  incidentStatusLabel,
  incidentStatusVariant,
  incidentTypeLabel,
} from '../utils/incident-labels'
import {
  actionLevelLabel,
  attentionLevelLabel,
  verificationLevelLabel,
} from '@/modules/priorities/utils/priority-labels'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { cn } from '@/shared/utils/cn'
import { useHasPermission } from '@/core/auth/AuthProvider'
import { useResponsesList } from '@/modules/response-orchestration/hooks/useResponseOrchestration'
import { ResponseStatusBadge } from '@/modules/response-orchestration/components/ResponseStatusBadge'
import type { ResponseBadgeKey } from '@/modules/response-orchestration/utils/response-status-labels'

export function IncidentsPage() {
  const [status, setStatus] = useState('')
  const query = useIncidentsList({ status: status || undefined })
  const canViewResponse = useHasPermission('responses.view')
  const responsesQuery = useResponsesList()
  const responseByIncident = new Map(
    (responsesQuery.data?.items ?? []).map((r) => [r.incident_id, r]),
  )

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <ModuleHeader
        title="Incidentes"
        description="Situaciones operacionales que agrupan eventos territoriales correlacionados."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {['', 'open', 'monitoring', 'resolved'].map((s) => (
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
            {s ? incidentStatusLabel(s) : 'Todos'}
          </button>
        ))}
      </div>

      {query.isLoading && <p className="text-sm text-text-tertiary">Cargando incidentes…</p>}
      {query.isError && (
        <p className="text-sm text-confidence-low">No se pudo cargar la lista de incidentes.</p>
      )}

      <div className="space-y-3">
        {(query.data?.items ?? []).map((item) => (
          <Link
            key={item.id}
            to={`/incidentes/${item.id}`}
            className="block rounded-lg border border-border-subtle bg-surface-2/30 p-4 hover:border-accent/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                  {incidentTypeLabel(item.incident_type)}
                </p>
                <h3 className="text-sm font-semibold text-text-primary">
                  Situación operacional · {item.event_count} evento(s)
                </h3>
                <p className="mt-1 text-xs text-text-tertiary">
                  {formatGuatemalaDateTime(item.first_observed_at)} —{' '}
                  {formatGuatemalaDateTime(item.last_observed_at)}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant={incidentStatusVariant(item.status)}>
                  {incidentStatusLabel(item.status)}
                </Badge>
                <Badge variant="default">{evidenceStatusLabel(item.evidence_status)}</Badge>
                {canViewResponse && responseByIncident.has(item.id) && (
                  <ResponseStatusBadge
                    badge={responseByIncident.get(item.id)!.badge as ResponseBadgeKey}
                  />
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-text-secondary">
              <span>Atención: {attentionLevelLabel(item.attention_level)}</span>
              <span>Verificación: {verificationLevelLabel(item.verification_level)}</span>
              <span>Acción: {actionLevelLabel(item.action_level)}</span>
              <span>Activos: {item.active_event_count}</span>
            </div>
          </Link>
        ))}
        {!query.isLoading && (query.data?.items?.length ?? 0) === 0 && (
          <p className="text-sm text-text-tertiary">No hay incidentes registrados todavía.</p>
        )}
      </div>
    </div>
  )
}
