import { Link } from 'react-router-dom'
import { ResponseOrchestrationExecutivePanel } from '@/modules/response-orchestration/components/ResponseOrchestrationExecutivePanel'
import { useNationalSituation } from '../../NationalSituationContext'
import { useSituationRouteAccess } from '../../hooks/useSituationRouteAccess'

export function OperacionesTab() {
  const { dashboardQuery } = useNationalSituation()
  const canMissions = useSituationRouteAccess('/misiones')
  const canAssignments = useSituationRouteAccess('/misiones/asignaciones')
  const canResponse = useSituationRouteAccess('/respuesta')
  const dashboard = dashboardQuery.data

  return (
    <div className="space-y-4" data-testid="tab-operaciones">
      {canMissions && (
        <section className="rounded-xl border border-border-subtle bg-surface-2/40 px-4 py-3">
          <div className="flex justify-between">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
              Misiones en curso
            </p>
            <Link to="/misiones" className="text-xs text-accent">
              Ver misiones →
            </Link>
          </div>
          {(dashboard?.missions_in_progress.length ?? 0) === 0 ? (
            <p className="mt-2 text-sm text-text-secondary">Sin misiones activas.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {dashboard!.missions_in_progress.map((m) => (
                <li key={m.id}>
                  <Link to={m.href} className="text-sm hover:text-accent">
                    {m.title}
                    {m.is_internal_demo && (
                      <span className="ml-1 text-[10px] text-violet-300">(demo)</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {canAssignments && (
        <Link
          to="/misiones/asignaciones"
          className="inline-block rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-secondary hover:text-accent"
        >
          Ver asignaciones →
        </Link>
      )}

      {canResponse && <ResponseOrchestrationExecutivePanel />}

      {canResponse && (dashboard?.pending_decisions.length ?? 0) > 0 && (
        <section className="rounded-xl border border-border-subtle bg-surface-2/40 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Decisiones pendientes
          </p>
          <ul className="mt-2 space-y-1">
            {dashboard!.pending_decisions.map((d, i) => (
              <li key={`${d.incident_id}-${i}`}>
                <Link to={d.href} className="text-sm hover:text-accent">
                  {d.decision_status} · {d.incident_id.slice(0, 8)}…
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
