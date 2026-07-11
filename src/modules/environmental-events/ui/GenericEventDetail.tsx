/**
 * Generic event detail — renders ANY registered event type from its manifest.
 */
import { buildEventDetailModel } from '@/modules/environmental-events/ui/event-ui'
import type { EnvironmentalEvent } from '@/modules/environmental-events/types/environmental-event.types'

export function GenericEventDetail({ event }: { event: EnvironmentalEvent }) {
  const model = buildEventDetailModel(event)
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">{model.title}</h2>
        <p className="text-sm text-slate-600">{model.summary}</p>
        <div className="mt-1 flex gap-3 text-xs text-slate-500">
          <span>{model.statusLabel}</span>
          <span>{model.lifecycleLabel}</span>
          <span>{model.severityLabel}</span>
          <span>{model.confidenceLabel}</span>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3">
        {model.metrics.map((m) => (
          <div key={m.key}>
            <dt className="text-xs text-slate-500">{m.label}</dt>
            <dd className="text-sm font-medium text-slate-800">{m.value}</dd>
          </div>
        ))}
      </dl>

      <div>
        <h3 className="text-sm font-semibold text-slate-800">Secciones</h3>
        <ul className="list-disc pl-5 text-sm text-slate-600">
          {model.sections.map((s) => (
            <li key={s.id}>{s.title}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-800">Metodología</h3>
        <p className="text-sm text-slate-600">{model.methodology}</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-800">Limitaciones</h3>
        <ul className="list-disc pl-5 text-sm text-slate-600">
          {model.limitations.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
