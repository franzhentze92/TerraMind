import { useQuery } from '@tanstack/react-query'
import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import { fetchResponseExecutiveSummary } from '../api/response-orchestration-api'
import { useHasPermission } from '@/core/auth/AuthProvider'

export function useResponseExecutiveSummary() {
  const authReady = useAuthQueryReady()
  const canView = useHasPermission('responses.view')
  return useQuery({
    queryKey: ['responses-executive-summary'],
    queryFn: () => fetchResponseExecutiveSummary(),
    enabled: authReady && canView,
  })
}
