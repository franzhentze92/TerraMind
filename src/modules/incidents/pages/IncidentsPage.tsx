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

type IncidentTab = 'operational' | 'historical' | 'demo'

const TAB_LABELS: Record<IncidentTab, string> = {
  operational: 'Operacionales',
  historical: 'Históricos',
  demo: 'Demostración',
}

function incidentBucket(classification?: string): IncidentTab {
  if (classification === 'demo') return 'demo'
  if (classification && classification !== 'operational') return 'historical'
  return 'operational'
}

export function IncidentsPage() {
  const [status, setStatus] = useState('')
  const [tab, setTab] = useState<IncidentTab>('operational')
  const query = useIncidentsList({ status: status || undefined, include_demo: 'true' })
  const canViewResponse = useHasPermission('responses.view')
  const responsesQuery = useResponsesList()
  const responseByIncident = new Map(
    (responsesQuery.data?.items ?? []).map((r) => [r.incident_id, r]),
  )

  const allItems = query.data?.items ?? []
  const tabCounts: Record<IncidentTab, number> = {
    operational: allItems.filter((i) => incidentBucket(i.classification) === 'operational').length,
    historical: allItems.filter((i) => incidentBucket(i.classification) === 'historical').length,
    demo: allItems.filter((i) => incidentBucket(i.classification) === 'demo').length,
  }
  const items = allItems.filter((i) => incidentBucket(i.classification) === tab)
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

      <div className="mb-3 mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Clasificación de incidentes">
        {(['operational', 'historical', 'demo'] as IncidentTab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-xs',
              tab === t
                ? 'border-accent bg-accent/10 text-text-primary'
                : 'border-border-subtle text-text-tertiary',
            )}
          >
            {TAB_LABELS[t]} ({tabCounts[t]})
          </button>
        ))}
      </div>

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
            {s ? incidentStatusLabel(s) : 'Todos los estados'}
          </button>
        ))}
      </div>

      {tab === 'demo' && tabCounts.demo > 0 && (
        <div className="mb-3 rounded-lg border border-confidence-medium/30 bg-confidence-medium/10 px-4 py-2 text-xs text-confidence-medium">
          Incidentes de demostración interna — no representan operaciones reales.
        </div>
      )}
      {tab === 'historical' && tabCounts.historical > 0 && (
        <div className="mb-3 rounded-lg border border-border-subtle bg-surface-2/30 px-4 py-2 text-xs text-text-tertiary">
          Registros históricos sin organización asignada. Se mantienen visibles pero no se cuentan como operacionales.
        </div>
      )}

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
        {listEmpty && !status && tab === 'operational' && (
          <OperationalEmptyState
            title="No hay incidentes operacionales."
            explanation="Los incidentes se crean cuando eventos correlacionados requieren seguimiento operacional."
            sourceProcess="Eventos → correlación → incidente"
            supplementalNote={
              tabCounts.historical > 0
                ? `${tabCounts.historical} incidente(s) histórico(s) disponibles en su pestaña.`
                : undefined
            }
            primaryAction={{ label: 'Ver actividad térmica', href: '/eventos' }}
            secondaryAction={{ label: 'Situación nacional', href: '/situacion' }}
          />
        )}
        {listEmpty && !status && tab === 'historical' && (
          <OperationalEmptyState
            title="No hay incidentes históricos."
            explanation="Aquí aparecen registros sin organización asignada, conservados para trazabilidad."
            sourceProcess="Registros previos → sin organización"
          />
        )}
        {listEmpty && !status && tab === 'demo' && (
          <OperationalEmptyState
            title="No hay incidentes de demostración."
            explanation="Los incidentes de demostración interna se usan solo para ejemplos y capacitación."
            sourceProcess="Demostración interna"
          />
        )}
      </div>
    </div>
  )
}
