import { useQuery } from '@tanstack/react-query'
import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import { fireApi } from '@/modules/fires/api/fire-api'

export function useFireEvent(eventId: string | undefined) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['fires', 'event', eventId],
    queryFn: () => fireApi.getEvent(eventId!),
    enabled: authReady && Boolean(eventId),
    staleTime: 30_000,
  })
}
