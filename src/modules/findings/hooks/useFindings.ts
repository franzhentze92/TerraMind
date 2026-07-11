import { useQuery } from '@tanstack/react-query'
import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import { findingsApi } from '../api/findings-api'

export function useFindingsList(params?: Record<string, string | undefined>) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['findings', 'list', params],
    queryFn: () => findingsApi.list(params),
    enabled: authReady,
  })
}

export function useFindingDetail(id?: string) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['findings', 'detail', id],
    queryFn: () => findingsApi.get(id!),
    enabled: authReady && Boolean(id),
  })
}

export function useFireEventFindings(eventId?: string) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['findings', 'fire-event', eventId],
    queryFn: () => findingsApi.forFireEvent(eventId!),
    enabled: authReady && Boolean(eventId),
  })
}
