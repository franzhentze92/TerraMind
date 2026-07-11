import { Link } from 'react-router-dom'
import { useNationalSituation } from '../NationalSituationContext'
import { useSituationRouteAccess } from '../hooks/useSituationRouteAccess'

const MAX_ITEMS = 3

export function TopPriorities() {
  const { dashboardQuery } = useNationalSituation()
  const canViewFindings = useSituationRouteAccess('/hallazgos')
  const findings = dashboardQuery.data?.priority_findings.slice(0, MAX_ITEMS) ?? []

  return (
    <section
      className="rounded-xl border border-border-subtle bg-surface-2/40 px-4 py-3"
      data-testid="top-priorities"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Prioridades principales
        </p>
        {canViewFindings && (
          <Link to="/prioridades" className="text-xs text-accent">
            Ver prioridades →
          </Link>
        )}
      </div>
      {findings.length === 0 ? (
        <p className="mt-2 text-sm text-text-secondary">Sin prioridades destacadas en la ventana.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {findings.map((f) => (
            <li
              key={f.id}
              className="rounded-md border border-border-subtle bg-surface-1/30 px-3 py-2"
            >
              {canViewFindings ? (
                <Link to={f.href} className="text-sm font-medium text-text-primary hover:text-accent">
                  {f.title}
                </Link>
              ) : (
                <p className="text-sm font-medium text-text-primary">{f.title}</p>
              )}
              <p className="mt-0.5 text-[11px] text-text-tertiary">
                {f.department_name ?? 'Ubicación no geocodificada'} · {f.severity_label}
              </p>
              <p className="mt-1 text-[10px] text-text-secondary">
                Atención elevada · revisar verificación en mapa
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
