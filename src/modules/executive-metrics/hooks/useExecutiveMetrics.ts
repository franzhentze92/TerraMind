import { useQuery } from '@tanstack/react-query'

import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import {
  fetchDataQualitySummary,
  fetchExecutiveMetrics,
  type ExecutiveMetricsQuery,
} from '@/modules/executive-metrics/api/executive-metrics-api'

export function useExecutiveMetrics(query: ExecutiveMetricsQuery = {}) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['executive-metrics', query.scope ?? 'all', query.includeDemo ?? false, query.includeLegacy ?? true],
    queryFn: () => fetchExecutiveMetrics(query),
    staleTime: 30_000,
    enabled: authReady,
  })
}

export function useDataQualitySummary() {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['executive-data-quality-summary'],
    queryFn: () => fetchDataQualitySummary(),
    staleTime: 30_000,
    enabled: authReady,
  })
}
