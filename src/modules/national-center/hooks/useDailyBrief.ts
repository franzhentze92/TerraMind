import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'
import type { SituationReport } from '@/pipeline/types'

export function useDailyBrief() {
  return useQuery({
    queryKey: ['situacion', 'brief'],
    queryFn: () => apiClient.get<SituationReport>('/situacion/brief'),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 2,
  })
}

export function usePipelineStatus() {
  return useQuery({
    queryKey: ['pipeline', 'status'],
    queryFn: () =>
      apiClient.get<{
        running: boolean
        lastSyncAt: string
        nextSyncAt: string
        systemStatus: string
      }>('/pipeline/status'),
    refetchInterval: 30_000,
  })
}
