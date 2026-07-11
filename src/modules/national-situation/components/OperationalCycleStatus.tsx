import { Link } from 'react-router-dom'
import { useNationalSituation } from '../NationalSituationContext'
import { useSituationRouteAccess } from '../hooks/useSituationRouteAccess'

export function OperationalCycleStatus() {
  const { dashboardQuery, metricsQuery } = useNationalSituation()
  const metrics = metricsQuery.data?.metrics ?? []

  const verifActive = metrics.find((m) => m.id === 'verification_needs_active')?.value ?? 0
  const evidencePending = dashboardQuery.data?.recent_evidence.length ?? 0
  const validations =
    dashboardQuery.data?.data_audit.find((d) => d.stage === 'evidence_validations')?.count ?? 0
  const resolutions = dashboardQuery.data?.recent_resolutions.length ?? 0
  const assessments = metrics.find((m) => m.id === 'response_assessments')?.value ?? 0

  const canVerif = useSituationRouteAccess('/verificaciones')
  const canMissions = useSituationRouteAccess('/misiones')
  const canResponse = useSituationRouteAccess('/respuesta')

  const lines = [
    { label: 'Verificaciones activas', value: verifActive, href: '/verificaciones', show: canVerif },
    { label: 'Evidencia pendiente', value: evidencePending, href: '/misiones', show: canMissions },
    { label: 'Validaciones', value: validations, href: '/verificaciones', show: canVerif },
    { label: 'Resoluciones', value: resolutions, href: '/verificaciones', show: canVerif },
    { label: 'Evaluaciones de respuesta', value: assessments, href: '/respuesta', show: canResponse },
  ].filter((l) => l.show)

  return (
    <section
      className="rounded-xl border border-border-subtle bg-surface-2/40 px-4 py-3"
      data-testid="operational-cycle-status"
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
        Estado del ciclo operativo
      </p>
      <ul className="mt-2 space-y-1">
        {lines.map((line) => (
          <li key={line.label} className="flex justify-between text-sm">
            <Link to={line.href} className="text-text-secondary hover:text-accent">
              {line.label}
            </Link>
            <span className="font-medium text-text-primary">{line.value}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-text-tertiary">
        El ciclo avanza cuando hay verificación resuelta con evidencia validada; las evaluaciones de
        respuesta se generan después.
      </p>
    </section>
  )
}
