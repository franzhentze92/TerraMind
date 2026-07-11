import { useQuery } from '@tanstack/react-query'
import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import { authFetch } from '@/core/auth/auth-fetch'
import type {
  IntelligenceFlowDto,
  IntelligenceFlowResourceType,
} from '../intelligence-flow.types'

export async function fetchIntelligenceFlow(
  resourceType: IntelligenceFlowResourceType,
  resourceId: string,
): Promise<IntelligenceFlowDto> {
  const res = await authFetch(`/api/intelligence-flow/${resourceType}/${resourceId}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<IntelligenceFlowDto>
}

export function useIntelligenceFlow(
  resourceType: IntelligenceFlowResourceType | undefined,
  resourceId: string | undefined,
) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['intelligence-flow', resourceType, resourceId],
    queryFn: () => fetchIntelligenceFlow(resourceType!, resourceId!),
    enabled: authReady && Boolean(resourceType && resourceId),
    staleTime: 30_000,
  })
}
