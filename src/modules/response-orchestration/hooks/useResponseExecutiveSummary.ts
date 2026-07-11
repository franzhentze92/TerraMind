import { useQuery } from '@tanstack/react-query'
import { fetchResponseExecutiveSummary } from '../api/response-orchestration-api'
import { useHasPermission } from '@/core/auth/AuthProvider'

export function useResponseExecutiveSummary() {
  const canView = useHasPermission('responses.view')
  return useQuery({
    queryKey: ['responses-executive-summary'],
    queryFn: () => fetchResponseExecutiveSummary(),
    enabled: canView,
  })
}
