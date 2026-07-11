import { useState } from 'react'
import { NationalTimeline } from '@/modules/executive-demo/components/StoryTimeline'
import { useNationalSituation } from '../../NationalSituationContext'
import { filterEntriesByPeriod } from '../../national-situation.constants'

export function TimelineTab() {
  const { dashboardQuery, periodHours } = useNationalSituation()
  const [filter, setFilter] = useState('all')
  const entries = filterEntriesByPeriod(dashboardQuery.data?.recent_changes ?? [], periodHours)

  return (
    <div data-testid="tab-timeline">
      <NationalTimeline entries={entries} filter={filter} onFilterChange={setFilter} />
    </div>
  )
}
