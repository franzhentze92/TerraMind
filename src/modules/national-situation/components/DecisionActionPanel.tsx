import { Link } from 'react-router-dom'
import { useNationalSituation } from '../NationalSituationContext'
import { useSituationRouteAccess } from '../hooks/useSituationRouteAccess'

export function DecisionActionPanel() {
  const { dashboardQuery, metricsQuery, pendingDecisionsCount } = useNationalSituation()
  const dashboard = dashboardQuery.data
  const canIncidents = useSituationRouteAccess('/incidentes')
  const canVerifications = useSituationRouteAccess('/verificaciones')
  const canMissions = useSituationRouteAccess('/misiones')
  const canResponse = useSituationRouteAccess('/respuesta')

  const verifNeeds =
    metricsQuery.data?.metrics.find((m) => m.id === 'verification_needs_active')?.value ?? 0
  const pendingVerif = dashboard?.pending_verifications.length ?? 0
  const missions = dashboard?.missions_in_progress.length ?? 0
  const evidence = dashboard?.recent_evidence.length ?? 0
  const resolutions = dashboard?.recent_resolutions.length ?? 0
  const recommendations = dashboard?.response_recommendations.length ?? 0

  const lines = [
    {
      label: 'Decisiones pendientes',
      value: pendingDecisionsCount,
      href: '/respuesta',
      show: canResponse,
    },
    {
      label: 'Verificaciones pendientes',
      value: Math.max(verifNeeds, pendingVerif),
      href: '/verificaciones',
      show: canVerifications,
    },
    {
      label: 'Misiones activas',
      value: missions,
      href: '/misiones',
      show: canMissions,
    },
    {
      label: 'Evidencia pendiente',
      value: evidence,
      href: '/misiones',
      show: canMissions,
    },
    {
      label: 'Cierre recomendado',
      value: resolutions + recommendations,
      href: '/respuesta',
      show: canResponse,
    },
  ]

  const visible = lines.filter((l) => l.show)
  const allZero = visible.every((l) => l.value === 0)

  if (allZero) {
    return (
      <section
        className="rounded-xl border border-border-subtle bg-surface-2/40 px-4 py-3"
        data-testid="decision-action-panel-empty"
      >
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Decisiones y acciones
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          No hay decisiones, verificaciones ni misiones pendientes en la organización.
        </p>
      </section>
    )
  }

  return (
    <section
      className="rounded-xl border border-border-subtle bg-surface-2/40 px-4 py-3"
      data-testid="decision-action-panel"
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
        Decisiones y acciones
      </p>
      <ul className="mt-2 space-y-1.5">
        {visible.map((line) => (
          <li key={line.label} className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">{line.label}</span>
            <Link to={line.href} className="font-medium text-accent hover:underline">
              {line.value}
            </Link>
          </li>
        ))}
      </ul>
      {canIncidents && (
        <Link to="/incidentes" className="mt-2 inline-block text-xs text-text-tertiary hover:text-accent">
          Ver incidentes →
        </Link>
      )}
    </section>
  )
}
