import { Link } from 'react-router-dom'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { freshnessLabel } from '@/modules/executive-metrics/data-quality-summary'
import { PageHeader } from '@/shared/components/PageHeader'
import { useNationalSituation } from '../NationalSituationContext'
import { SituationPeriodSelector } from './SituationPeriodSelector'
import { resolveSystemHealth } from '../utils/situation-labels'
import { pluralizeCount } from '@/shared/format/plural'
import { cn } from '@/shared/utils/cn'

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
        <>
          <StatusBadge label={health.label} tone={health.tone} />
          <span className="rounded-md border border-border-subtle px-2 py-0.5 text-xs text-text-secondary">
            {pluralizeCount(sourcesActive, 'proceso con datos recientes', 'procesos con datos recientes')}
          </span>
          {lastSync && (
            <span className="text-xs text-text-tertiary">
              Última sincronización: {formatGuatemalaDateTime(lastSync)}
            </span>
          )}
          {dq && (
            <span
              className={cn(
                'text-xs',
                dq.freshnessStatus === 'fresh' ? 'text-emerald-300' : 'text-amber-300',
              )}
            >
              Frescura: {freshnessLabel(dq.freshnessStatus)}
            </span>
          )}
        </>
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

function StatusBadge({ label, tone }: { label: string; tone: 'ok' | 'warning' | 'danger' }) {
  return (
    <span
      className={cn(
        'rounded-md px-2 py-0.5 text-xs font-medium',
        tone === 'ok'
          ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          : tone === 'danger'
            ? 'border border-red-500/30 bg-red-500/10 text-red-200'
            : 'border border-amber-500/30 bg-amber-500/10 text-amber-200',
      )}
    >
      {label}
    </span>
  )
}
