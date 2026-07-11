import { Link } from 'react-router-dom'
import { useNationalSituation } from '../NationalSituationContext'
import { useSituationRouteAccess } from '../hooks/useSituationRouteAccess'
import { findingSeverityLabel } from '@/modules/findings/utils/finding-labels'
import { findingTypeReason } from '../utils/situation-labels'

const MAX_FINDINGS = 5

export function TopFindings({ compact = false }: { compact?: boolean }) {
  const { dashboardQuery } = useNationalSituation()
  const canView = useSituationRouteAccess('/hallazgos')
  const limit = compact ? 3 : MAX_FINDINGS
  const findings = dashboardQuery.data?.priority_findings.slice(0, limit) ?? []

  return (
    <section
      className="rounded-xl border border-border-subtle bg-surface-2/40 px-4 py-3"
      data-testid="top-findings"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Hallazgos prioritarios
        </p>
        {canView && (
          <Link to="/hallazgos" className="text-xs text-accent">
            Ver todos los hallazgos →
          </Link>
        )}
      </div>
      {findings.length === 0 ? (
        <p className="mt-2 text-sm text-text-secondary">Sin hallazgos activos en la ventana.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {findings.map((f) => (
            <li key={f.id} className="rounded-md border border-border-subtle bg-surface-1/30 px-3 py-2">
              {canView ? (
                <Link to={f.href} className="text-sm font-medium hover:text-accent">
                  {f.title}
                </Link>
              ) : (
                <p className="text-sm font-medium">{f.title}</p>
              )}
              <dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-text-tertiary">
                <div>
                  <dt className="inline">Ubicación: </dt>
                  <dd className="inline text-text-secondary">
                    {f.department_name ?? 'Sin departamento'}
                  </dd>
                </div>
                <div>
                  <dt className="inline">Severidad: </dt>
                  <dd className="inline text-text-secondary">
                    {findingSeverityLabel(f.severity_label)}
                  </dd>
                </div>
              </dl>
              {findingTypeReason(f.finding_type) && (
                <p className="mt-1 text-[10px] text-text-secondary">
                  <span className="text-text-tertiary">Razón de prioridad: </span>
                  {findingTypeReason(f.finding_type)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
