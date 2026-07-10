import { useQuery } from '@tanstack/react-query'
import { fireApi } from '@/modules/fires/api/fire-api'

export function useFirePipelineHealth() {
  return useQuery({
    queryKey: ['fires', 'pipeline', 'health'],
    queryFn: () => fireApi.getPipelineHealth(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}
