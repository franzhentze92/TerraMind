/**
 * Generic event card — renders ANY registered event type from its manifest.
 * Plugins contribute a manifest; no per-type card component is needed.
 */
import { buildEventCardModel } from '@/modules/environmental-events/ui/event-ui'
import type { EnvironmentalEvent } from '@/modules/environmental-events/types/environmental-event.types'

export function GenericEventCard({ event }: { event: EnvironmentalEvent }) {
  const model = buildEventCardModel(event)
  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{model.title}</h3>
        <span className="text-xs text-slate-500">{model.statusLabel}</span>
      </header>
      <p className="mb-3 text-sm text-slate-600">{model.summary}</p>
      <dl className="grid grid-cols-2 gap-2">
        {model.metrics.map((m) => (
          <div key={m.key}>
            <dt className="text-xs text-slate-500">{m.label}</dt>
            <dd className="text-sm font-medium text-slate-800">{m.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  )
}
