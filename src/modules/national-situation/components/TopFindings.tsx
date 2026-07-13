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
        <ul className="mt-2 space-y-1">
          {findings.map((f) => {
            const reason = findingTypeReason(f.finding_type)
            const meta = [
              f.department_name ?? 'Sin departamento',
              findingSeverityLabel(f.severity_label),
              reason,
            ]
              .filter(Boolean)
              .join(' · ')
            const body = (
              <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-1/30 px-2.5 py-1.5 transition-colors hover:border-accent/40">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-text-primary">{f.title}</p>
                  <p className="truncate text-[10px] text-text-secondary">{meta}</p>
                </div>
                {canView && <span className="flex-shrink-0 text-xs text-accent">→</span>}
              </div>
            )
            return (
              <li key={f.id}>
                {canView ? (
                  <Link to={f.href} className="block">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
