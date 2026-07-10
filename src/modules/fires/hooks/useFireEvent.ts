import { useQuery } from '@tanstack/react-query'
import { fireApi } from '@/modules/fires/api/fire-api'

export function useFireEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: ['fires', 'event', eventId],
    queryFn: () => fireApi.getEvent(eventId!),
    enabled: Boolean(eventId),
    staleTime: 30_000,
  })
}
