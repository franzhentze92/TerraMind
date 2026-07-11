import { useQuery } from '@tanstack/react-query'
import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import {
  fetchFireEventPriority,
  fetchPrioritiesList,
  fetchPriorityDetail,
} from '../api/priorities-api'

export function usePrioritiesList(filters: Record<string, string | undefined> = {}) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['priorities', 'list', filters],
    queryFn: () => fetchPrioritiesList(filters),
    enabled: authReady,
  })
}

export function usePriorityDetail(id?: string) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['priorities', 'detail', id],
    queryFn: () => fetchPriorityDetail(id!),
    enabled: authReady && Boolean(id),
  })
}

export function useFireEventPriority(eventId?: string) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['priorities', 'fire-event', eventId],
    queryFn: () => fetchFireEventPriority(eventId!),
    enabled: authReady && Boolean(eventId),
  })
}
