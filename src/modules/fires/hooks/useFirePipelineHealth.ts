import { useQuery } from '@tanstack/react-query'
import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import { fireApi } from '@/modules/fires/api/fire-api'

export function useFirePipelineHealth() {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['fires', 'pipeline', 'health'],
    queryFn: () => fireApi.getPipelineHealth(),
    staleTime: 60_000,
    refetchInterval: authReady ? 120_000 : false,
    enabled: authReady,
  })
}
