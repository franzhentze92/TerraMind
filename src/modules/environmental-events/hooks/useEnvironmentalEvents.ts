/**
 * Environmental Event Framework — React Query hooks.
 *
 * Consumers that only need thermal data should keep using the specialized
 * `/incendios` hooks; these hooks are for cross-type / generic consumers so we
 * never double-load thermal endpoints for the same component.
 */
import { useQuery } from '@tanstack/react-query'
import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import { environmentalEventsApi } from '@/modules/environmental-events/api/environmental-events.api'
import type { EnvironmentalEventQuery } from '@/modules/environmental-events/types/environmental-event.types'

export function useEnvironmentalEvents(query?: EnvironmentalEventQuery) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['environmental-events', 'list', query ?? {}],
    queryFn: () => environmentalEventsApi.list(query),
    staleTime: 30_000,
    enabled: authReady,
  })
}

export function useEnvironmentalEvent(id: string | undefined) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['environmental-events', 'detail', id],
    queryFn: () => environmentalEventsApi.getById(id as string),
    staleTime: 30_000,
    enabled: authReady && Boolean(id),
  })
}

export function useEnvironmentalEventTypes() {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['environmental-events', 'types'],
    queryFn: () => environmentalEventsApi.types(),
    staleTime: 60_000,
    enabled: authReady,
  })
}
