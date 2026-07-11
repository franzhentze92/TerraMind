import { useQuery } from '@tanstack/react-query'
import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import { fireApi } from '@/modules/fires/api/fire-api'
import { pageFiltersToApiQuery, type FirePageFilters } from '@/modules/fires/api/fire-page-filters'

export function useFireEventsGeoJson(filters: FirePageFilters, layerEnabled = true) {
  const authReady = useAuthQueryReady()
  const apiQuery = pageFiltersToApiQuery({ ...filters, page: 1 })

  return useQuery({
    queryKey: ['fires', 'geojson', 'events', apiQuery],
    queryFn: () => fireApi.getEventsGeoJson(apiQuery),
    enabled: authReady && layerEnabled,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

export function useFireDetectionsGeoJson(
  filters: FirePageFilters,
  layerEnabled: boolean,
) {
  const authReady = useAuthQueryReady()
  const apiQuery = pageFiltersToApiQuery({ ...filters, page: 1 })

  return useQuery({
    queryKey: ['fires', 'geojson', 'detections', apiQuery],
    queryFn: () => fireApi.getDetectionsGeoJson(apiQuery),
    enabled: authReady && layerEnabled,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}
