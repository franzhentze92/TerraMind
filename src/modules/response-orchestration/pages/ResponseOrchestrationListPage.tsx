import { Link } from 'react-router-dom'
import { useState } from 'react'
import { PageHeader, OperationalEmptyState, FilterEmptyState, OperationalListSkeleton, OperationalErrorState } from '@/shared/components'
import { useResponsesList } from '../hooks/useResponseOrchestration'
import { ResponseStatusBadge } from '../components/ResponseStatusBadge'
import {
  decisionStatusLabel,
  responseLevelLabel,
  RESPONSE_BADGE_LABELS,
  type ResponseBadgeKey,
} from '../utils/response-status-labels'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { cn } from '@/shared/utils/cn'
import { useCanonicalOperationalCounts } from '@/shared/hooks/useCanonicalOperationalCounts'

const FILTERS: Array<{ id: string; label: string }> = [
  { id: '', label: 'Todos' },
  { id: 'pendiente_decision', label: RESPONSE_BADGE_LABELS.pendiente_decision },
  { id: 'monitoreo', label: RESPONSE_BADGE_LABELS.monitoreo },
  { id: 'seguimiento_operacional', label: RESPONSE_BADGE_LABELS.seguimiento_operacional },
  { id: 'revision_autorizada', label: RESPONSE_BADGE_LABELS.revision_autorizada },
  { id: 'accion_en_curso', label: RESPONSE_BADGE_LABELS.accion_en_curso },
  { id: 'cierre_recomendado', label: RESPONSE_BADGE_LABELS.cierre_recomendado },
  { id: 'bloqueado_incertidumbre', label: RESPONSE_BADGE_LABELS.bloqueado_incertidumbre },
]

export function ResponseOrchestrationListPage() {
  const [filter, setFilter] = useState('')
  const query = useResponsesList(filter || undefined)
  const counts = useCanonicalOperationalCounts()
  const items = query.data?.items ?? []
  const listEmpty = !query.isLoading && !query.isError && items.length === 0

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <PageHeader
        title="Respuesta operacional"
        subtitle="Recomendaciones del motor, decisiones humanas y acciones de seguimiento — separadas explícitamente."
        breadcrumbs={[
          { label: 'Operaciones', to: '/verificaciones' },
          { label: 'Respuesta' },
        ]}
      />

      <div className="mb-4 mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id || 'all'}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-xs',
              filter === f.id
                ? 'border-accent bg-accent/10 text-text-primary'
                : 'border-border-subtle text-text-tertiary',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {query.isLoading && <OperationalListSkeleton />}
      {query.isError && (
        <OperationalErrorState
          title="No se pudo cargar el listado de respuestas"
          explanation="Verifica tu conexión e intenta de nuevo."
          friendlyCode="RSP-LIST"
          onRetry={() => void query.refetch()}
        />
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.incident_id}
            to={`/respuesta/${item.incident_id}`}
            className="block rounded-lg border border-border-subtle bg-surface-2/30 p-4 hover:border-accent/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                  Incidente {item.incident_id.slice(0, 8)}…
                </p>
                <h3 className="text-sm font-semibold text-text-primary">
                  {responseLevelLabel(item.recommended_level)}
                </h3>
                <p className="mt-1 text-xs text-text-tertiary">
                  Decisión: {decisionStatusLabel(item.decision_status)} · Urgencia: {item.urgency}
                </p>
                {item.next_milestone && (
                  <p className="mt-1 text-xs text-text-tertiary">
                    Próximo hito: {formatGuatemalaDateTime(item.next_milestone)}
                  </p>
                )}
              </div>
              <ResponseStatusBadge badge={item.badge as ResponseBadgeKey} />
            </div>
            <p className="mt-2 text-[10px] text-text-tertiary">
              Actualizado: {formatGuatemalaDateTime(item.updated_at)}
            </p>
          </Link>
        ))}
        {listEmpty && filter && (
          <FilterEmptyState resourceLabel="evaluaciones" onClearFilters={() => setFilter('')} />
        )}
        {listEmpty && !filter && counts.incidentsOperational === 0 && (
          <OperationalEmptyState
            title="No hay incidentes operacionales elegibles para evaluación de respuesta"
            explanation="Se requiere un incidente con organización asignada y verificación resuelta."
            sourceProcess="Resolución → evaluación de respuesta"
            primaryAction={{ label: 'Ver incidentes', href: '/incidentes' }}
          />
        )}
        {listEmpty && !filter && counts.incidentsOperational > 0 && (
          <OperationalEmptyState
            title="Aún no existe una evaluación de respuesta"
            explanation="Se generará después de resolver una verificación y completar las reevaluaciones necesarias."
            sourceProcess="Resolución de verificación → evaluación de respuesta"
            primaryCta={{ label: 'Ver verificaciones', to: '/verificaciones' }}
            secondaryCta={{ label: 'Ver incidentes', to: '/incidentes' }}
          />
        )}
      </div>
    </div>
  )
}
