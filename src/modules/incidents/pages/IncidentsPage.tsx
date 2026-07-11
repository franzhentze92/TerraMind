import { Link } from 'react-router-dom'
import { useState } from 'react'
import {
  PageHeader,
  FilterEmptyState,
  OperationalEmptyState,
  OperationalListSkeleton,
  OperationalErrorState,
} from '@/shared/components'
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
import { buildIncidentDisplayName } from '../utils/incident-display-name'
import { cn } from '@/shared/utils/cn'
import { useHasPermission } from '@/core/auth/AuthProvider'
import { useResponsesList } from '@/modules/response-orchestration/hooks/useResponseOrchestration'
import { ResponseStatusBadge } from '@/modules/response-orchestration/components/ResponseStatusBadge'
import type { ResponseBadgeKey } from '@/modules/response-orchestration/utils/response-status-labels'
import { ClassificationBadge } from '@/modules/executive-metrics/components/ClassificationBadge'
import { useCanonicalOperationalCounts } from '@/shared/hooks/useCanonicalOperationalCounts'

export function IncidentsPage() {
  const [status, setStatus] = useState('')
  const query = useIncidentsList({ status: status || undefined })
  const canViewResponse = useHasPermission('responses.view')
  const counts = useCanonicalOperationalCounts()
  const responsesQuery = useResponsesList()
  const responseByIncident = new Map(
    (responsesQuery.data?.items ?? []).map((r) => [r.incident_id, r]),
  )

  const items = query.data?.items ?? []
  const listEmpty = !query.isLoading && !query.isError && items.length === 0

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6" data-testid="incidents-page">
      <PageHeader
        title="Incidentes"
        subtitle="Situaciones operacionales que agrupan eventos territoriales correlacionados."
        breadcrumbs={[
          { label: 'Inteligencia', to: '/hallazgos' },
          { label: 'Incidentes' },
        ]}
      />

      <div className="mb-4 mt-4 flex flex-wrap gap-2">
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

      {query.isLoading && <OperationalListSkeleton />}
      {query.isError && (
        <OperationalErrorState
          title="No se pudo cargar la lista de incidentes"
          explanation="Verifica tu conexión e intenta de nuevo."
          friendlyCode="INC-LIST"
          onRetry={() => void query.refetch()}
        />
      )}

      <div className="space-y-3">
        {items.map((item) => (
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
                  {buildIncidentDisplayName({
                    incident_type: item.incident_type,
                    status: item.status,
                    event_count: item.event_count,
                  })}
                </h3>
                <p className="mt-1 text-xs text-text-tertiary">
                  {formatGuatemalaDateTime(item.first_observed_at)} —{' '}
                  {formatGuatemalaDateTime(item.last_observed_at)}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {item.classification && <ClassificationBadge classification={item.classification} />}
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

        {listEmpty && status && (
          <FilterEmptyState resourceLabel="incidentes" onClearFilters={() => setStatus('')} />
        )}
        {listEmpty && !status && (
          <OperationalEmptyState
            title="No hay incidentes operacionales pertenecientes a la organización"
            explanation="Los incidentes se crean cuando eventos correlacionados requieren seguimiento operacional."
            sourceProcess="Eventos → correlación → incidente"
            supplementalNote={
              counts.incidentsLegacy > 0
                ? `${counts.incidentsLegacy} incidente(s) legacy están pendientes de ownership.`
                : undefined
            }
            primaryAction={{ label: 'Ver actividad térmica', href: '/eventos' }}
            secondaryAction={{ label: 'Situación nacional', href: '/situacion' }}
          />
        )}
      </div>
    </div>
  )
}
