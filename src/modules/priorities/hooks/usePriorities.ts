import { useQuery } from '@tanstack/react-query'
import {
  fetchFireEventPriority,
  fetchPrioritiesList,
  fetchPriorityDetail,
} from '../api/priorities-api'

export function usePrioritiesList(filters: Record<string, string | undefined> = {}) {
  return useQuery({
    queryKey: ['priorities', 'list', filters],
    queryFn: () => fetchPrioritiesList(filters),
  })
}

export function usePriorityDetail(id?: string) {
  return useQuery({
    queryKey: ['priorities', 'detail', id],
    queryFn: () => fetchPriorityDetail(id!),
    enabled: Boolean(id),
  })
}

export function useFireEventPriority(eventId?: string) {
  return useQuery({
    queryKey: ['priorities', 'fire-event', eventId],
    queryFn: () => fetchFireEventPriority(eventId!),
    enabled: Boolean(eventId),
  })
}
