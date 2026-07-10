import { useQuery } from '@tanstack/react-query'
import { fireApi } from '@/modules/fires/api/fire-api'
import { pageFiltersToApiQuery, type FirePageFilters } from '@/modules/fires/api/fire-page-filters'

export function useFireEventsGeoJson(filters: FirePageFilters, enabled = true) {
  const apiQuery = pageFiltersToApiQuery({ ...filters, page: 1 })

  return useQuery({
    queryKey: ['fires', 'geojson', 'events', apiQuery],
    queryFn: () => fireApi.getEventsGeoJson(apiQuery),
    enabled,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

export function useFireDetectionsGeoJson(
  filters: FirePageFilters,
  enabled: boolean,
) {
  const apiQuery = pageFiltersToApiQuery({ ...filters, page: 1 })

  return useQuery({
    queryKey: ['fires', 'geojson', 'detections', apiQuery],
    queryFn: () => fireApi.getDetectionsGeoJson(apiQuery),
    enabled,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}
