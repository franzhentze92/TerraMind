import { useQuery } from '@tanstack/react-query'
import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import {
  fetchIncidentVerificationPlan,
  fetchVerificationPlanDetail,
  fetchVerificationPlans,
} from '../api/verification-api'

export function useVerificationPlansList(filters: Record<string, string | undefined> = {}) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['verification-plans', filters],
    queryFn: () => fetchVerificationPlans(filters),
    enabled: authReady,
  })
}

export function useVerificationPlanDetail(planId: string | undefined) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['verification-plan', planId],
    queryFn: () => fetchVerificationPlanDetail(planId!),
    enabled: authReady && Boolean(planId),
  })
}

export function useIncidentVerificationPlan(incidentId: string | undefined) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['incident-verification-plan', incidentId],
    queryFn: () => fetchIncidentVerificationPlan(incidentId!),
    enabled: authReady && Boolean(incidentId),
  })
}
