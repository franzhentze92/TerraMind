import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFireEvent } from '@/modules/fires/hooks/useFireEvent'
import { useFireEvents } from '@/modules/fires/hooks/useFireEvents'
import { useFireEventsGeoJson } from '@/modules/fires/hooks/useFireGeoJson'
import {
  DEFAULT_FIRE_PAGE_FILTERS,
} from '@/modules/fires/api/fire-page-filters'
import { FireEventsMap } from '@/modules/fires/components/FireEventsMap'
import { useFireEventIncident } from '@/modules/incidents/hooks/useIncidents'
import { useFireEventPriority } from '@/modules/priorities/hooks/usePriorities'
import { useFireEventLifecycle } from '@/modules/lifecycle/hooks/useLifecycle'
import { lifecycleStateLabel } from '@/modules/lifecycle/utils/lifecycle-labels'
import { validationStatusLabel } from '@/modules/fires/utils/fire-interpretation'
import { riskLevelLabel } from '@/modules/fires/utils/format'
import { Switch } from '@/shared/components/Switch'
import type { ExecutiveDashboardDto } from '../types/executive-demo.types'

interface ExecutiveNationalMapProps {
  includeDemo: boolean
  activeIncidents: ExecutiveDashboardDto['active_incidents']
}

function ExecutiveMapSidePanel({
  eventId,
  onClose,
}: {
  eventId: string
  onClose: () => void
}) {
  const eventQuery = useFireEvent(eventId)
  const incidentQuery = useFireEventIncident(eventId)
  const priorityQuery = useFireEventPriority(eventId)
  const lifecycleQuery = useFireEventLifecycle(eventId)
  const event = eventQuery.data
  const incident = incidentQuery.data?.incident

  return (
    <aside className="flex max-h-[420px] flex-col overflow-hidden rounded-lg border border-border-subtle bg-surface-1">
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
          Selección en mapa
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-text-tertiary hover:text-text-primary"
        >
          Cerrar
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 text-sm">
        {eventQuery.isLoading && <p className="text-text-tertiary">Cargando evento…</p>}
        {event && (
          <>
            <p className="font-medium text-text-primary">
              {event.department_name ?? 'Evento térmico'}
            </p>
            <p className="mt-1 text-[11px] text-text-tertiary">ID: {event.id.slice(0, 12)}…</p>
            <dl className="mt-3 space-y-2 text-xs">
              <div>
                <dt className="text-text-tertiary">Estado</dt>
                <dd>{validationStatusLabel(event.validation_status)}</dd>
              </div>
              <div>
                <dt className="text-text-tertiary">Prioridad</dt>
                <dd>
                  {priorityQuery.data?.assessment
                    ? `${priorityQuery.data.assessment.attention_level} · ${riskLevelLabel(event.risk_level)}`
                    : riskLevelLabel(event.risk_level)}
                </dd>
              </div>
              <div>
                <dt className="text-text-tertiary">Ciclo de vida</dt>
                <dd>
                  {lifecycleQuery.data?.lifecycle_state
                    ? lifecycleStateLabel(lifecycleQuery.data.lifecycle_state)
                    : 'Sin transición registrada'}
                </dd>
              </div>
              <div>
                <dt className="text-text-tertiary">Verificación</dt>
                <dd>{validationStatusLabel(event.validation_status)}</dd>
              </div>
            </dl>
            {incident && (
              <div className="mt-4 rounded border border-border-subtle bg-surface-2/40 p-2">
                <p className="text-[10px] font-medium uppercase text-text-tertiary">Incidente</p>
                <p className="mt-1 text-xs">
                  {incident.id.slice(0, 8)}… · {incident.status}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link to={`/incidentes/${incident.id}`} className="text-xs text-accent">
                    Ver incidente
                  </Link>
                  <Link
                    to={`/incidentes/${incident.id}/historia`}
                    className="text-xs text-accent"
                  >
                    Historia
                  </Link>
                  <Link
                    to={`/informes/incidentes/${incident.id}`}
                    className="text-xs text-text-tertiary"
                  >
                    Informe
                  </Link>
                </div>
              </div>
            )}
            {!incident && !incidentQuery.isLoading && (
              <p className="mt-3 text-xs text-text-secondary">
                Sin incidente correlacionado para este evento.
              </p>
            )}
            <Link
              to={`/incendios/${event.id}`}
              className="mt-4 inline-block text-xs text-accent"
            >
              Abrir en análisis de incendios →
            </Link>
          </>
        )}
      </div>
    </aside>
  )
}

export function ExecutiveNationalMap({ includeDemo, activeIncidents }: ExecutiveNationalMapProps) {
  const filters = useMemo(() => DEFAULT_FIRE_PAGE_FILTERS, [])
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>()
  const [showIncidentsLayer, setShowIncidentsLayer] = useState(true)
  const showDetections = false

  const eventsQuery = useFireEvents(filters)
  const geoJsonQuery = useFireEventsGeoJson(filters)
  const items = eventsQuery.data?.items ?? []

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-2/40 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Mapa operacional
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
          <span className="text-confidence-medium">● Eventos</span>
          <span className="text-accent">● Prioridad (color)</span>
          <label className="flex items-center gap-1.5">
            <Switch checked={showIncidentsLayer} onChange={setShowIncidentsLayer} />
            Incidentes ({activeIncidents.length})
          </label>
          <span
            className="flex items-center gap-1.5 text-text-tertiary"
            title="Detecciones puntuales disponibles en /incendios"
          >
            Detecciones (ver /incendios)
          </span>
          <span className="text-text-tertiary" title="Ciclo de vida visible al seleccionar un evento">
            Lifecycle (panel lateral)
          </span>
        </div>
      </div>

      {!includeDemo && activeIncidents.length === 0 && (
        <p className="mt-2 text-xs text-text-secondary">
          Capa de incidentes vacía sin demostraciones — solo eventos térmicos visibles.
        </p>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_280px]">
        <FireEventsMap
          className="h-[420px] min-h-[280px] rounded-lg border border-border-subtle"
          eventsGeoJson={geoJsonQuery.data}
          eventListItems={items}
          showDetections={showDetections}
          selectedEventId={selectedEventId}
          isLoading={geoJsonQuery.isLoading}
          isError={geoJsonQuery.isError}
          onSelectEvent={setSelectedEventId}
          onViewDetail={setSelectedEventId}
        />
        {selectedEventId ? (
          <ExecutiveMapSidePanel eventId={selectedEventId} onClose={() => setSelectedEventId(undefined)} />
        ) : (
          <div className="hidden rounded-lg border border-dashed border-border-subtle bg-surface-1/30 px-4 py-6 text-xs text-text-tertiary lg:block">
            Seleccione un evento en el mapa para ver prioridad, ciclo de vida, verificación e
            incidente correlacionado.
            {showIncidentsLayer && activeIncidents.length > 0 && (
              <ul className="mt-3 space-y-1">
                {activeIncidents.slice(0, 4).map((inc) => (
                  <li key={inc.id}>
                    <Link to={inc.href} className="text-accent">
                      {inc.id.slice(0, 8)}… · {inc.status}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
