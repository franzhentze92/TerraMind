import { apiClient } from '@/core/api/client'
import type {
  BiodiversityDashboardFilters,
  BiodiversityDashboardSummaryDto,
  BiodiversityZoneDetailDto,
  BiodiversityZonesListDto,
} from '@/modules/biodiversity/types/biodiversity-dashboard.types'
import type { BiodiversitySystemHealth } from '@/modules/biodiversity/types/biodiversity-health.types'
import { filtersToQueryString } from '@/modules/biodiversity/api/biodiversity-page-filters'

function withQuery(path: string, filters?: BiodiversityDashboardFilters): string {
  if (!filters) return path
  const qs = filtersToQueryString(filters)
  return qs ? `${path}?${qs}` : path
}

export const biodiversityApi = {
  getDashboardSummary(filters?: BiodiversityDashboardFilters) {
    return apiClient.get<BiodiversityDashboardSummaryDto>(
      withQuery('/environment/biodiversity/dashboard-summary', filters),
    )
  },

  getZones() {
    return apiClient.get<BiodiversityZonesListDto>('/environment/biodiversity/zones')
  },

  getZoneSummary(zoneCode: string, filters?: BiodiversityDashboardFilters) {
    return apiClient.get<BiodiversityZoneDetailDto>(
      withQuery(`/environment/biodiversity/zones/${zoneCode}/summary`, filters),
    )
  },

  getHealth() {
    return apiClient.get<BiodiversitySystemHealth>('/environment/biodiversity/health')
  },

  getVisualSummary(filters?: BiodiversityDashboardFilters) {
    return apiClient.get<import('@/modules/biodiversity/biodiversity-visual.types').BiodiversityVisualSummaryDto>(
      withQuery('/environment/biodiversity/visual-summary', filters),
    )
  },

  getVisualDetail(source: string, occurrenceId: string, filters?: BiodiversityDashboardFilters) {
    return apiClient.get<import('@/modules/biodiversity/biodiversity-visual.types').BiodiversityVisualDetailDto>(
      withQuery(`/environment/biodiversity/visual/${source}/${occurrenceId}`, filters),
    )
  },
}
