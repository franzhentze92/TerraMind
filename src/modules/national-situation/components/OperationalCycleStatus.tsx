import { Link } from 'react-router-dom'
import { useNationalSituation } from '../NationalSituationContext'
import { useSituationRouteAccess } from '../hooks/useSituationRouteAccess'

interface StatLine {
  label: string
  value: number
  href: string
  show: boolean
}

/**
 * Consolidated "Estado operativo" panel — merges the former decision/action and
 * operational-cycle blocks into a single, non-duplicated view. Operational
 * metrics are kept strictly separate from historical records.
 */
export function OperationalCycleStatus() {
  const { dashboardQuery, metricsQuery, pendingDecisionsCount } = useNationalSituation()
  const dashboard = dashboardQuery.data
  const metrics = metricsQuery.data?.metrics ?? []

  const canVerif = useSituationRouteAccess('/verificaciones')
  const canMissions = useSituationRouteAccess('/misiones')
  const canResponse = useSituationRouteAccess('/respuesta')
  const canIncidents = useSituationRouteAccess('/incidentes')

  const verifActive = metrics.find((m) => m.id === 'verification_needs_active')?.value ?? 0
  const missions = dashboard?.missions_in_progress.length ?? 0
  const evidencePending = dashboard?.recent_evidence.length ?? 0
  const actionsInProgress = dashboard?.response_recommendations.length ?? 0

  const legacyPlans = metrics.find((m) => m.id === 'verification_plans_legacy')?.value ?? 0
  const legacyIncidents =
    metrics
      .find((m) => m.id === 'incidents_operational')
      ?.breakdown.filter((b) => !b.included && b.classification === 'legacy')
      .reduce((s, b) => s + b.value, 0) ?? 0

  const operational: StatLine[] = [
    { label: 'Verificaciones activas', value: verifActive, href: '/verificaciones', show: canVerif },
    { label: 'Misiones activas', value: missions, href: '/misiones', show: canMissions },
    { label: 'Evidencia pendiente', value: evidencePending, href: '/misiones', show: canMissions },
    {
      label: 'Decisiones pendientes',
      value: pendingDecisionsCount,
      href: '/respuesta',
      show: canResponse,
    },
    { label: 'Acciones en curso', value: actionsInProgress, href: '/respuesta', show: canResponse },
  ].filter((l) => l.show)

  const historical: StatLine[] = [
    {
      label: 'Planes de verificación',
      value: legacyPlans,
      href: '/verificaciones',
      show: canVerif,
    },
    { label: 'Incidentes', value: legacyIncidents, href: '/incidentes?legacy=1', show: canIncidents },
  ].filter((l) => l.show && l.value > 0)

  return (
    <section
      className="rounded-xl border border-border-subtle bg-surface-2/40 px-4 py-3"
      data-testid="operational-cycle-status"
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
        Estado operativo
      </p>
      <ul className="mt-2 space-y-1.5">
        {operational.map((line) => (
          <li key={line.label} className="flex items-center justify-between text-sm">
            <Link to={line.href} className="text-text-secondary hover:text-accent">
              {line.label}
            </Link>
            <span className="font-medium text-text-primary">{line.value}</span>
          </li>
        ))}
      </ul>

      {historical.length > 0 && (
        <div className="mt-3 border-t border-border-subtle pt-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Registros históricos
          </p>
          <ul className="mt-2 space-y-1.5">
            {historical.map((line) => (
              <li key={line.label} className="flex items-center justify-between text-sm">
                <Link to={line.href} className="text-text-secondary hover:text-accent">
                  {line.label}
                </Link>
                <span className="font-medium text-text-primary">{line.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
