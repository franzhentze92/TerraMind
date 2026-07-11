import type { EmptyStateInfo, ExecutiveMetric } from '../types/executive-demo.types'
import { Link } from 'react-router-dom'

export function ExecutiveMetricGrid({ metrics }: { metrics: ExecutiveMetric[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {metrics.map((m) => (
        <div
          key={m.key}
          className="rounded-lg border border-border-subtle bg-surface-1/40 px-3 py-2"
        >
          <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{m.label}</p>
          {m.href ? (
            <Link to={m.href} className="text-xl font-semibold text-accent hover:underline">
              {m.value}
            </Link>
          ) : (
            <p className="text-xl font-semibold text-text-primary">{m.value}</p>
          )}
        </div>
      ))}
    </div>
  )
}

export function ExecutiveSummaryPanel({
  summary,
}: {
  summary: {
    what_is_happening: string
    what_changed: string
    requires_attention: string
    in_verification: string
    terramind_recommends: string
    pending_decision: string
  }
}) {
  const items = [
    ['Qué está ocurriendo', summary.what_is_happening],
    ['Qué cambió', summary.what_changed],
    ['Requiere atención', summary.requires_attention],
    ['En verificación', summary.in_verification],
    ['Recomienda TerraMind', summary.terramind_recommends],
    ['Pendiente de decisión', summary.pending_decision],
  ] as const

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-2/40 px-5 py-4">
      <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
        Resumen ejecutivo
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {items.map(([label, text]) => (
          <div key={label} className="rounded-md border border-border-subtle bg-surface-1/30 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-accent">{label}</p>
            <p className="mt-1 text-sm text-text-secondary">{text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function EmptyStateCard({ state }: { state: EmptyStateInfo }) {
  return (
    <div className="rounded-lg border border-dashed border-border-subtle bg-surface-1/20 px-4 py-3">
      <p className="text-sm font-medium text-text-primary">{state.title}</p>
      <p className="mt-1 text-xs text-text-tertiary">{state.meaning}</p>
      <p className="mt-2 text-sm text-text-secondary">{state.why_empty}</p>
      <p className="mt-1 text-[10px] text-text-tertiary">Alimentado por: {state.fed_by}</p>
    </div>
  )
}

export function DemoBanner() {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
      Demostración interna — no representa un evento ambiental confirmado
    </div>
  )
}

export function SystemStatusBar({
  status,
  lastSync,
  sourcesActive,
}: {
  status: string
  lastSync: string | null
  sourcesActive: number
}) {
  return (
    <div className="flex flex-wrap gap-4 rounded-lg border border-border-subtle bg-surface-1/50 px-4 py-2 text-xs text-text-secondary">
      <span>
        Sistema: <strong className="text-text-primary">{status}</strong>
      </span>
      <span>Fuentes activas: {sourcesActive}</span>
      <span>Última sync: {lastSync ? new Date(lastSync).toLocaleString('es-GT') : 'n/d'}</span>
    </div>
  )
}
