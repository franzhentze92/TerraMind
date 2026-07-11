import { FireHeatSummaryCard } from '@/modules/fires/components/FireHeatSummaryCard'
import { useFireSummary } from '@/modules/fires/hooks/useFireSummary'
import { NationalTimeline } from '@/modules/executive-demo/components/StoryTimeline'
import { useState } from 'react'
import { useNationalSituation } from '../../NationalSituationContext'
import { filterEntriesByPeriod } from '../../national-situation.constants'

export function ActividadTab() {
  const fireSummary = useFireSummary()
  const { dashboardQuery, periodHours } = useNationalSituation()
  const [filter, setFilter] = useState('all')
  const changes = filterEntriesByPeriod(dashboardQuery.data?.recent_changes ?? [], periodHours)

  return (
    <div className="space-y-4" data-testid="tab-actividad">
      <FireHeatSummaryCard
        data={fireSummary.data}
        isLoading={fireSummary.isLoading}
        isError={fireSummary.isError}
      />
      <NationalTimeline entries={changes} filter={filter} onFilterChange={setFilter} />
    </div>
  )
}
