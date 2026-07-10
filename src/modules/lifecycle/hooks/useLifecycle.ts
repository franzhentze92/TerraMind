import { useQuery } from '@tanstack/react-query'
import {
  fetchEntityLifecycle,
  fetchEntityLifecycleTransitions,
} from '../api/lifecycle-api'

export function useFireEventLifecycle(eventId?: string) {
  return useQuery({
    queryKey: ['lifecycle', 'fire_event', eventId],
    queryFn: () => fetchEntityLifecycle('fire_event', eventId!),
    enabled: Boolean(eventId),
  })
}

export function useFireEventLifecycleTransitions(eventId?: string) {
  return useQuery({
    queryKey: ['lifecycle', 'transitions', eventId],
    queryFn: () => fetchEntityLifecycleTransitions('fire_event', eventId!),
    enabled: Boolean(eventId),
  })
}
