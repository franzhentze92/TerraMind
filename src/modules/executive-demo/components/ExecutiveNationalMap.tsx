/**
 * ExecutiveNationalMap — "Mapa de eventos activos" (registry-driven).
 *
 * The central element of Situación Nacional. It renders every enabled event
 * type through the EnvironmentalEventRegistry map renderers (thermal points,
 * rainfall-deficit polygons, and any future type) with NO per-type branches.
 * Legend, colors and layer toggles all derive from the registry. Selection is
 * shared through the National Situation context so the right-hand
 * "Evento seleccionado" panel stays in sync.
 */
import { useMemo, useState } from 'react'
import { useNationalSituation } from '@/modules/national-situation/NationalSituationContext'
import { NationalEventMap } from '@/modules/national-situation/components/NationalEventMap'
import { markSituationPerformance } from '@/modules/national-situation/situation-performance'
import { EventTypeIcon } from '@/modules/environmental-events/ui/EventTypeIcon'
import { Switch } from '@/shared/components/Switch'
import type { ExecutiveDashboardDto } from '../types/executive-demo.types'

interface ExecutiveNationalMapProps {
  includeDemo: boolean
  activeIncidents: ExecutiveDashboardDto['active_incidents']
  /** Kept for compatibility; historical incident overlays are not part of the event map. */
  showLegacyLayer?: boolean
}

export function ExecutiveNationalMap({
  includeDemo,
  activeIncidents,
  showLegacyLayer = false,
}: ExecutiveNationalMapProps) {
  const { eventTypes, eventsWindowSince, selectedEventId, setSelectedEventId } =
    useNationalSituation()
  const { types, isError } = eventTypes

  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set())
  const [centerToken, setCenterToken] = useState(0)

  const toggleType = (type: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const operationalIncidents = useMemo(
    () => activeIncidents.filter((i) => !i.is_legacy && (!i.is_internal_demo || includeDemo)),
    [activeIncidents, includeDemo],
  )

  const hasTypes = types.length > 0

  return (
    <section
      className="flex h-full flex-col rounded-xl border border-border-subtle bg-surface-2/40 px-4 py-3"
      data-testid="executive-national-map"
      data-show-legacy-layer={showLegacyLayer}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-text-primary">
          Mapa de eventos activos
        </p>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-secondary">
          {types.map((t) => (
            <label key={t.type} className="flex items-center gap-1.5" title={`Mostrar/ocultar ${t.label}`}>
              <Switch checked={!hiddenTypes.has(t.type)} onChange={() => toggleType(t.type)} />
              <span className={`flex items-center gap-1 ${hiddenTypes.has(t.type) ? 'opacity-40' : ''}`}>
                <EventTypeIcon icon={t.icon} color={t.accentColor} size={13} />
                {t.label}
              </span>
            </label>
          ))}
          <button
            type="button"
            onClick={() => setCenterToken((c) => c + 1)}
            className="rounded border border-border-subtle px-2 py-0.5 text-[10px] hover:border-accent/40"
          >
            Centrar Guatemala
          </button>
        </div>
      </div>

      {isError && (
        <p className="mt-2 text-xs text-status-critical">
          No se pudieron cargar todos los tipos de evento del mapa.
        </p>
      )}

      {!hasTypes ? (
        <div className="mt-3 flex h-[360px] items-center justify-center rounded-lg border border-border-subtle bg-surface-1/40 text-xs text-text-secondary">
          No hay tipos de evento habilitados para mostrar en el mapa.
        </div>
      ) : (
        <div className="relative mt-3 flex-1">
          <NationalEventMap
            className="h-[400px] min-h-[340px] w-full rounded-lg border border-border-subtle md:h-[470px]"
            types={types}
            hiddenTypes={hiddenTypes}
            since={eventsWindowSince}
            selectedEventId={selectedEventId}
            onSelect={setSelectedEventId}
            centerToken={centerToken}
            onLayerReady={() => markSituationPerformance('map_ready')}
          />

          <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-border-subtle bg-surface-1/90 px-3 py-2 backdrop-blur">
            <p className="text-[9px] font-medium uppercase tracking-wider text-text-tertiary">
              Tipos de evento
            </p>
            <ul className="mt-1 space-y-0.5">
              {types.map((t) => (
                <li
                  key={t.type}
                  className={`flex items-center gap-1.5 text-[10px] text-text-secondary ${
                    hiddenTypes.has(t.type) ? 'opacity-40' : ''
                  }`}
                >
                  <EventTypeIcon icon={t.icon} color={t.accentColor} size={12} />
                  {t.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {operationalIncidents.length > 0 && (
        <p className="mt-2 text-[11px] text-text-tertiary">
          {operationalIncidents.length}{' '}
          {operationalIncidents.length === 1 ? 'incidente operativo' : 'incidentes operativos'} vinculados.
        </p>
      )}
    </section>
  )
}
