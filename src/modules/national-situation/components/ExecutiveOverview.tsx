import { DemoBanner } from '@/modules/executive-demo/components/ExecutiveDashboardPanels'
import { ExecutiveNationalMap } from '@/modules/executive-demo/components/ExecutiveNationalMap'
import { useNationalSituation } from '../NationalSituationContext'
import { AutoEventSelection } from './AutoEventSelection'
import { ExecutiveKpiGrid } from './ExecutiveKpiGrid'
import { EventTypeBreakdown } from './EventTypeBreakdown'
import { ExecutiveSummary } from './ExecutiveSummary'
import { SelectedEventPanel } from './SelectedEventPanel'
import { EventDistributionChart } from './EventDistributionChart'
import { OperationalStatusPanel } from './OperationalStatusPanel'
import { IntelligenceTimeline } from './IntelligenceTimeline'
import { TerritorialPanorama } from './TerritorialPanorama'
import { SituationOperationalHeader } from './SituationOperationalHeader'
import { SituationTabs } from './SituationTabs'
import { DataQualityCard } from '@/modules/executive-metrics/components/DataQualityCard'

/**
 * Situación Nacional — future-state dashboard.
 *
 * Layout follows the approved reference: a KPI row + per-type breakdown, a
 * three-column band (executive summary · central event map · selected event),
 * a three-column operations band (distribution · operational status ·
 * intelligence timeline), tabs, and a territorial footer. All data is
 * canonical/registry-driven; empty states are honest.
 */
export function ExecutiveOverview() {
  const { includeDemo, dashboardQuery, dqQuery } = useNationalSituation()
  const dashboard = dashboardQuery.data

  return (
    <div className="space-y-3" data-testid="executive-overview">
      <AutoEventSelection />
      <SituationOperationalHeader />

      {includeDemo && <DemoBanner />}

      {/* KPI row (5 multi-event KPIs) + per-type breakdown as the 6th cell */}
      <div className="grid gap-2 xl:grid-cols-[minmax(0,5fr)_minmax(0,1fr)]">
        <ExecutiveKpiGrid />
        <EventTypeBreakdown />
      </div>

      {/* Central band: summary (~22%) · map (~54%) · selected event (~22%) */}
      <div className="grid items-stretch gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)_minmax(0,1fr)]">
        <ExecutiveSummary />
        <ExecutiveNationalMap
          includeDemo={includeDemo}
          activeIncidents={dashboard?.active_incidents ?? []}
          showLegacyLayer={false}
        />
        <SelectedEventPanel />
      </div>

      {/* Operations band: distribution · operational status · intelligence */}
      <div className="grid items-stretch gap-3 md:grid-cols-2 xl:grid-cols-3">
        <EventDistributionChart />
        <OperationalStatusPanel />
        <IntelligenceTimeline />
      </div>

      {dqQuery.data && (
        <details className="rounded-xl border border-border-subtle bg-surface-2/40">
          <summary className="cursor-pointer px-4 py-2 text-xs text-text-tertiary">
            Ver calidad de datos
          </summary>
          <div className="px-2 pb-2">
            <DataQualityCard summary={dqQuery.data} />
          </div>
        </details>
      )}

      <SituationTabs />

      <TerritorialPanorama />
    </div>
  )
}
