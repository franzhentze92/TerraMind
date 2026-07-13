/**
 * Generic per-type event list page.
 *
 * Registry-driven: the `:type` route param selects a registered, enabled type
 * (validated against the server-authoritative enabled-type list). Used by the
 * dynamic sidebar entries for non-thermal types (e.g. rainfall deficit).
 */
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@/shared/components/PageHeader'
import { useEnvironmentalEvents } from '@/modules/environmental-events/hooks/useEnvironmentalEvents'
import { environmentalEventRegistry } from '@/modules/environmental-events/registry/event-type-registry'
import { ensureEventsRegistered } from '@/modules/environmental-events/registry/register-all'
import { buildEventCardModel } from '@/modules/environmental-events/ui/event-ui'
import { EventTypeIcon } from '@/modules/environmental-events/ui/EventTypeIcon'
import { useDashboardEventTypes } from '@/modules/national-situation/hooks/useDashboardEventTypes'
import { isEnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'
import { eventDetailHref } from '@/modules/national-situation/utils/event-detail-href'

ensureEventsRegistered()

export function EnvironmentalEventTypeListPage() {
  const { type: typeParam } = useParams<{ type: string }>()
  const { types } = useDashboardEventTypes()

  const type = typeParam && isEnvironmentalEventType(typeParam) ? typeParam : undefined
  const enabled = useMemo(() => types.find((t) => t.type === type), [types, type])

  const eventsQuery = useEnvironmentalEvents(
    // `limit` is capped at 100 by the generic list route (larger values → 400).
    type ? { type, status: 'active', limit: 100 } : undefined,
  )
  const items = type ? (eventsQuery.data?.items ?? []) : []

  if (!type || (!enabled && !eventsQuery.isLoading && types.length > 0)) {
    return (
      <div className="h-full overflow-y-auto bg-surface-0">
        <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
          <PageHeader title="Tipo de evento no disponible" subtitle="Situación Nacional" />
          <p className="mt-6 text-sm text-text-secondary">
            Este tipo de evento no está habilitado actualmente.
          </p>
          <Link to="/situacion" className="mt-3 inline-block text-sm text-accent hover:underline">
            ← Volver a Situación Nacional
          </Link>
        </div>
      </div>
    )
  }

  const manifest = environmentalEventRegistry.tryGet(type)

  return (
    <div className="h-full overflow-y-auto bg-surface-0">
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
        <PageHeader
          title={manifest?.label ?? 'Eventos'}
          subtitle="Situación Nacional"
        />

        {eventsQuery.isLoading ? (
          <div className="mt-6 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-3/40" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="mt-6 text-sm text-text-secondary">
            No se detectaron eventos activos de este tipo.
          </p>
        ) : (
          <ul className="mt-6 space-y-2">
            {items.map((event) => {
              const model = buildEventCardModel(event)
              return (
                <li key={event.id}>
                  <Link
                    to={eventDetailHref(event.eventType, event.id)}
                    className="flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-2/40 px-4 py-3 transition-colors hover:border-accent/40"
                  >
                    <EventTypeIcon
                      icon={model.icon}
                      color={enabled?.accentColor}
                      size={18}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{model.title}</p>
                      <p className="truncate text-xs text-text-secondary">{model.summary}</p>
                    </div>
                    <span className="flex-shrink-0 text-xs text-text-tertiary">{model.statusLabel}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
