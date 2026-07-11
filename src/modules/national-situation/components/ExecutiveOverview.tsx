import { DemoBanner } from '@/modules/executive-demo/components/ExecutiveDashboardPanels'
import { ExecutiveNationalMap } from '@/modules/executive-demo/components/ExecutiveNationalMap'
import { useNationalSituation } from '../NationalSituationContext'
import { ExecutiveKpiGrid } from './ExecutiveKpiGrid'
import { ExecutiveSummary } from './ExecutiveSummary'
import { TopPriorities } from './TopPriorities'
import { OperationalCycleStatus } from './OperationalCycleStatus'
import { IntelligenceLinePreview } from './IntelligenceLineDrawer'
import { SituationOperationalHeader } from './SituationOperationalHeader'
import { SituationTabs } from './SituationTabs'
import { DataQualityCard } from '@/modules/executive-metrics/components/DataQualityCard'

export function ExecutiveOverview() {
  const { includeDemo, dashboardQuery, dqQuery } = useNationalSituation()
  const dashboard = dashboardQuery.data

  return (
    <div className="space-y-4" data-testid="executive-overview">
      <SituationOperationalHeader />

      {includeDemo && <DemoBanner />}

      <ExecutiveKpiGrid />

      <div className="grid gap-4 lg:grid-cols-2">
        <ExecutiveSummary />
        <TopPriorities />
      </div>

      {dashboard && (
        <ExecutiveNationalMap
          includeDemo={includeDemo}
          activeIncidents={dashboard.active_incidents}
          showLegacyLayer={false}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <OperationalCycleStatus />
        <IntelligenceLinePreview />
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
    </div>
  )
}
