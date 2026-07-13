/**
 * Generic environmental event detail page.
 *
 * Renders ANY registered event type from its manifest (presentation adapter,
 * methodology, limitations). Thermal keeps its dedicated `/incendios` page; this
 * is the generic surface for every other type (e.g. rainfall deficit).
 */
import { useParams, Link } from 'react-router-dom'
import { useEnvironmentalEvent } from '@/modules/environmental-events/hooks/useEnvironmentalEvents'
import { environmentalEventRegistry } from '@/modules/environmental-events/registry/event-type-registry'
import { ensureEventsRegistered } from '@/modules/environmental-events/registry/register-all'
import { buildEventDetailModel } from '@/modules/environmental-events/ui/event-ui'
import { EventTypeIcon } from '@/modules/environmental-events/ui/EventTypeIcon'
import { PageHeader } from '@/shared/components/PageHeader'

ensureEventsRegistered()

export function EnvironmentalEventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const eventQuery = useEnvironmentalEvent(eventId)
  const event = eventQuery.data

  return (
    <div className="h-full overflow-y-auto bg-surface-0">
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
        <PageHeader title="Detalle del evento" subtitle="Situación Nacional" />

        {eventQuery.isLoading && (
          <div className="mt-6 space-y-3">
            <div className="h-6 w-64 animate-pulse rounded bg-surface-3/50" />
            <div className="h-40 w-full animate-pulse rounded bg-surface-3/30" />
          </div>
        )}

        {eventQuery.isError && (
          <p className="mt-6 text-sm text-status-critical">No se pudo cargar el evento solicitado.</p>
        )}

        {event &&
          (() => {
            const manifest = environmentalEventRegistry.get(event.eventType)
            const accent = environmentalEventRegistry.getAccentColor(event.eventType)
            const model = buildEventDetailModel(event)
            return (
              <article className="mt-6 space-y-6">
                <header>
                  <span
                    className="inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium"
                    style={{ color: accent, borderColor: `${accent}55`, backgroundColor: `${accent}14` }}
                  >
                    <EventTypeIcon icon={manifest.icon} color={accent} size={13} />
                    {manifest.label}
                  </span>
                  <h2 className="mt-2 text-xl font-semibold text-text-primary">{model.title}</h2>
                  <p className="mt-1 text-sm text-text-secondary">{model.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-tertiary">
                    <span>{model.statusLabel}</span>
                    <span>{model.lifecycleLabel}</span>
                    <span>{model.severityLabel}</span>
                    <span>{model.confidenceLabel}</span>
                  </div>
                </header>

                {model.metrics.length > 0 && (
                  <section className="rounded-xl border border-border-subtle bg-surface-2/40 p-4">
                    <h3 className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                      Métricas clave
                    </h3>
                    <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {model.metrics.map((m) => (
                        <div key={m.key}>
                          <dt className="text-[11px] text-text-tertiary">{m.label}</dt>
                          <dd className="text-sm font-medium text-text-primary">{m.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}

                <section className="rounded-xl border border-border-subtle bg-surface-2/40 p-4">
                  <h3 className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                    Metodología
                  </h3>
                  <p className="mt-2 text-sm text-text-secondary">{model.methodology}</p>
                </section>

                {model.limitations.length > 0 && (
                  <section className="rounded-xl border border-border-subtle bg-surface-2/40 p-4">
                    <h3 className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                      Limitaciones
                    </h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
                      {model.limitations.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </section>
                )}

                <Link to="/situacion" className="inline-block text-sm text-accent hover:underline">
                  ← Volver a Situación Nacional
                </Link>
              </article>
            )
          })()}
      </div>
    </div>
  )
}
