import { Link } from 'react-router-dom'
import { useResponseExecutiveSummary } from '../hooks/useResponseExecutiveSummary'
import { ResponseStatusBadge } from './ResponseStatusBadge'
import {
  decisionStatusLabel,
  responseLevelLabel,
  type ResponseBadgeKey,
} from '../utils/response-status-labels'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'

export function ResponseOrchestrationExecutivePanel() {
  const query = useResponseExecutiveSummary()
  const items = query.data?.items ?? []
  const summary = query.data?.summary

  if (query.isLoading) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface-2/40 px-5 py-4">
        <p className="text-sm text-text-tertiary">Cargando estado de respuesta operacional…</p>
      </div>
    )
  }

  if (query.isError || !summary || summary.total_with_assessment === 0) {
    return null
  }

  const highlight = items.slice(0, 5)

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-2/40 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Respuesta operacional
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Capa de decisión separada de scores de atención/acción — solo incidentes con assessment.
          </p>
        </div>
        <Link to="/respuesta" className="text-xs font-medium text-accent hover:underline">
          Ver todas →
        </Link>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <Metric label="Con assessment" value={summary.total_with_assessment} />
        <Metric label="Pendiente decisión" value={summary.pending_decision} />
        <Metric label="Acción en curso" value={summary.action_in_progress} />
        <Metric label="Bloqueado" value={summary.blocked_by_uncertainty} />
      </div>

      <ul className="mt-4 space-y-2">
        {highlight.map((item) => (
          <li key={item.incident_id}>
            <Link
              to={`/respuesta/${item.incident_id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle bg-surface-1/40 px-3 py-2 hover:border-accent/30"
            >
              <div>
                <p className="text-xs font-medium text-text-primary">
                  {responseLevelLabel(item.recommended_level)}
                </p>
                <p className="text-[10px] text-text-tertiary">
                  Decisión: {decisionStatusLabel(item.decision_status)} ·{' '}
                  {formatGuatemalaDateTime(item.updated_at)}
                </p>
              </div>
              <ResponseStatusBadge badge={item.badge as ResponseBadgeKey} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-1/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className="text-lg font-semibold text-text-primary">{value}</p>
    </div>
  )
}
