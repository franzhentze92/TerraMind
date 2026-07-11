import { useQuery } from '@tanstack/react-query'
import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import { fireApi } from '@/modules/fires/api/fire-api'
import {
  pageFiltersToApiQuery,
  type FirePageFilters,
} from '@/modules/fires/api/fire-page-filters'

export function useFireEvents(filters: FirePageFilters) {
  const authReady = useAuthQueryReady()
  const apiQuery = pageFiltersToApiQuery(filters)

  return useQuery({
    queryKey: ['fires', 'events', apiQuery],
    queryFn: ({ signal }) => {
      const controller = new AbortController()
      signal?.addEventListener('abort', () => controller.abort())
      return fireApi.listEvents(apiQuery)
    },
    staleTime: 30_000,
    enabled: authReady,
  })
}

export function useFireDepartments() {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['fires', 'departments'],
    queryFn: () => fireApi.getDepartments(),
    staleTime: 300_000,
    enabled: authReady,
  })
}
