import { Link } from 'react-router-dom'
import { useNationalSituation } from '../NationalSituationContext'
import { useSituationRouteAccess } from '../hooks/useSituationRouteAccess'
import { attentionLevelLabel } from '@/modules/priorities/utils/priority-labels'

const MAX_ITEMS = 3

function formatScore(score: number): string {
  return `${Number.isInteger(score) ? score : score.toFixed(1)}/100`
}

export function TopPriorities() {
  const { dashboardQuery } = useNationalSituation()
  const canView = useSituationRouteAccess('/prioridades')
  const priorities = dashboardQuery.data?.top_priorities.slice(0, MAX_ITEMS) ?? []

  return (
    <section
      className="rounded-xl border border-border-subtle bg-surface-2/40 px-4 py-3"
      data-testid="top-priorities"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Prioridades principales
        </p>
        {canView && priorities.length > 0 && (
          <Link to="/prioridades" className="text-xs text-accent">
            Ver prioridades →
          </Link>
        )}
      </div>
      {priorities.length === 0 ? (
        <div className="mt-2">
          <p className="text-sm text-text-secondary">No hay prioridades operativas disponibles.</p>
          <p className="mt-1 text-[11px] text-text-tertiary">
            Las prioridades se generan cuando el modelo evalúa los eventos térmicos y sus hallazgos
            asociados.
          </p>
        </div>
      ) : (
        <ul className="mt-2 space-y-2">
          {priorities.map((p) => (
            <li
              key={p.id}
              className="rounded-md border border-border-subtle bg-surface-1/30 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  {canView ? (
                    <Link
                      to={p.href}
                      className="text-sm font-medium text-text-primary hover:text-accent"
                    >
                      {p.title}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-text-primary">{p.title}</p>
                  )}
                  <p className="mt-0.5 text-[11px] text-text-tertiary">
                    {p.department_name ?? 'Ubicación no geocodificada'} ·{' '}
                    {attentionLevelLabel(p.attention_level)}
                  </p>
                </div>
                {canView && (
                  <Link to={p.href} className="shrink-0 text-[11px] text-accent">
                    Ver prioridad →
                  </Link>
                )}
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-text-tertiary">
                <div>
                  <dt>Atención</dt>
                  <dd className="font-medium text-text-primary">
                    {formatScore(p.attention_score)}
                  </dd>
                </div>
                <div>
                  <dt>Valor de verificar</dt>
                  <dd className="font-medium text-text-primary">
                    {formatScore(p.verification_score)}
                  </dd>
                </div>
                <div>
                  <dt>Preparación operativa</dt>
                  <dd className="font-medium text-text-primary">{formatScore(p.action_score)}</dd>
                </div>
              </dl>
              {p.primary_factor && (
                <p className="mt-1.5 text-[10px] text-text-secondary">
                  <span className="text-text-tertiary">Factor principal: </span>
                  {p.primary_factor}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
