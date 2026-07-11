import { useQuery } from '@tanstack/react-query'
import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import {
  fetchEntityLifecycle,
  fetchEntityLifecycleTransitions,
} from '../api/lifecycle-api'

export function useFireEventLifecycle(eventId?: string) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['lifecycle', 'fire_event', eventId],
    queryFn: () => fetchEntityLifecycle('fire_event', eventId!),
    enabled: authReady && Boolean(eventId),
  })
}

export function useFireEventLifecycleTransitions(eventId?: string) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['lifecycle', 'transitions', eventId],
    queryFn: () => fetchEntityLifecycleTransitions('fire_event', eventId!),
    enabled: authReady && Boolean(eventId),
  })
}
