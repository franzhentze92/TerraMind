import { Link } from 'react-router-dom'
import { useNationalSituation } from '../NationalSituationContext'
import { useSituationRouteAccess } from '../hooks/useSituationRouteAccess'
import { incidentStatusLabel } from '@/modules/incidents/utils/incident-labels'
import { attentionLevelLabel } from '@/modules/priorities/utils/priority-labels'
import { pluralizeCount } from '@/shared/format/plural'
import { HISTORICAL_PENDING_ORG_SUFFIX } from '../utils/situation-labels'

export function IncidentsOverview() {
  const { dashboardQuery, metricsQuery, includeDemo } = useNationalSituation()
  const canView = useSituationRouteAccess('/incidentes')
  const operational = dashboardQuery.data?.active_incidents.filter((i) => !i.is_legacy) ?? []
  const legacyCount =
    metricsQuery.data?.metrics
      .find((m) => m.id === 'incidents_operational')
      ?.breakdown.filter((b) => !b.included && b.classification === 'legacy')
      .reduce((s, b) => s + b.value, 0) ?? 0

  return (
    <section
      className="rounded-xl border border-border-subtle bg-surface-2/40 px-4 py-3"
      data-testid="incidents-overview"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Incidentes operacionales
        </p>
        {canView && (
          <Link to="/incidentes" className="text-xs text-accent">
            Ver incidentes →
          </Link>
        )}
      </div>
      {operational.length === 0 ? (
        <p className="mt-2 text-sm text-text-secondary">
          No hay incidentes operacionales pertenecientes a la organización.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {operational.slice(0, 5).map((inc) => (
            <li key={inc.id} className="rounded border border-border-subtle px-3 py-2 text-sm">
              {canView ? (
                <Link to={inc.href} className="font-medium hover:text-accent">
                  {inc.story_coverage}
                </Link>
              ) : (
                <span>{inc.story_coverage}</span>
              )}
              <p className="text-[10px] text-text-tertiary">
                {incidentStatusLabel(inc.status)} · {attentionLevelLabel(inc.attention_level)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {legacyCount > 0 && (
        <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
          <span className="text-amber-200">
            {pluralizeCount(legacyCount, 'registro histórico', 'registros históricos')}{' '}
            {HISTORICAL_PENDING_ORG_SUFFIX}
          </span>
          {canView && (
            <Link to="/incidentes?legacy=1" className="ml-2 text-accent">
              Ver registros históricos
            </Link>
          )}
        </div>
      )}
      {includeDemo && dashboardQuery.data?.recommended_demo_incident_id && canView && (
        <p className="mt-2 text-[10px] text-violet-300">
          Demostración activa — incidente sugerido visible en el mapa.
        </p>
      )}
    </section>
  )
}
