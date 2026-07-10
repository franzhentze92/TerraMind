import { useQuery } from '@tanstack/react-query'
import { findingsApi } from '../api/findings-api'

export function useFindingsList(params?: Record<string, string | undefined>) {
  return useQuery({
    queryKey: ['findings', 'list', params],
    queryFn: () => findingsApi.list(params),
  })
}

export function useFindingDetail(id?: string) {
  return useQuery({
    queryKey: ['findings', 'detail', id],
    queryFn: () => findingsApi.get(id!),
    enabled: Boolean(id),
  })
}

export function useFireEventFindings(eventId?: string) {
  return useQuery({
    queryKey: ['findings', 'fire-event', eventId],
    queryFn: () => findingsApi.forFireEvent(eventId!),
    enabled: Boolean(eventId),
  })
}
