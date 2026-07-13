import { Link } from 'react-router-dom'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { PageHeader } from '@/shared/components/PageHeader'
import { useNationalSituation } from '../NationalSituationContext'
import { SituationPeriodSelector } from './SituationPeriodSelector'
import { resolveSystemHealth } from '../utils/situation-labels'
import { pluralizeCount } from '@/shared/format/plural'
import { cn } from '@/shared/utils/cn'

const HEALTH_DOT: Record<'ok' | 'warning' | 'danger', string> = {
  ok: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger: 'bg-red-400',
}

export function SituationOperationalHeader() {
  const {
    territoryName,
    dashboardQuery,
    dqQuery,
    setSourcesOpen,
    includeDemo,
    setIncludeDemo,
  } = useNationalSituation()

  const dashboard = dashboardQuery.data
  const dq = dqQuery.data
  const health = resolveSystemHealth(dashboard?.system_status, dq?.freshnessStatus)
  const lastSync = dashboard?.last_sync_at
  const sourcesActive = dashboard?.sources_active ?? 0

  return (
    <PageHeader
      title="Situación Nacional"
      subtitle={`Territorio activo: ${territoryName}`}
      updatedAt={
        dashboard?.generated_at ? formatGuatemalaDateTime(dashboard.generated_at) : undefined
      }
      meta={
        <span
          className="flex items-center gap-1.5 text-xs text-text-secondary"
          data-testid="situation-health"
        >
          <span className={cn('h-2 w-2 rounded-full', HEALTH_DOT[health.tone])} aria-hidden />
          <span>
            {health.label}
            {' · '}
            {pluralizeCount(sourcesActive, 'fuente reciente', 'fuentes recientes')}
            {lastSync && ` · Sincronizado ${formatGuatemalaDateTime(lastSync)}`}
          </span>
        </span>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <SituationPeriodSelector />
          <button
            type="button"
            onClick={() => setSourcesOpen(true)}
            className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
            data-testid="sources-drawer-trigger"
          >
            Ver fuentes de datos
          </button>
          <Link
            to="/informes/nacional"
            className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs text-text-secondary hover:text-accent"
          >
            Generar informe
          </Link>
          <label className="flex items-center gap-1.5 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={includeDemo}
              onChange={(e) => setIncludeDemo(e.target.checked)}
              aria-label="Mostrar demostraciones"
              className="h-3.5 w-3.5"
            />
            Demostración
          </label>
        </div>
      }
    />
  )
}
