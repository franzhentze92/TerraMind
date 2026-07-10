import { useQuery } from '@tanstack/react-query'
import { fireApi } from '@/modules/fires/api/fire-api'
import {
  pageFiltersToApiQuery,
  type FirePageFilters,
} from '@/modules/fires/api/fire-page-filters'

export function useFireEvents(filters: FirePageFilters) {
  const apiQuery = pageFiltersToApiQuery(filters)

  return useQuery({
    queryKey: ['fires', 'events', apiQuery],
    queryFn: ({ signal }) => {
      const controller = new AbortController()
      signal?.addEventListener('abort', () => controller.abort())
      return fireApi.listEvents(apiQuery)
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

export function useFireDepartments() {
  return useQuery({
    queryKey: ['fires', 'departments'],
    queryFn: () => fireApi.getDepartments(),
    staleTime: 300_000,
  })
}
