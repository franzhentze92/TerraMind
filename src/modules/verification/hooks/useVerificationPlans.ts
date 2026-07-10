import { useQuery } from '@tanstack/react-query'
import {
  fetchIncidentVerificationPlan,
  fetchVerificationPlanDetail,
  fetchVerificationPlans,
} from '../api/verification-api'

export function useVerificationPlansList(filters: Record<string, string | undefined> = {}) {
  return useQuery({
    queryKey: ['verification-plans', filters],
    queryFn: () => fetchVerificationPlans(filters),
  })
}

export function useVerificationPlanDetail(planId: string | undefined) {
  return useQuery({
    queryKey: ['verification-plan', planId],
    queryFn: () => fetchVerificationPlanDetail(planId!),
    enabled: Boolean(planId),
  })
}

export function useIncidentVerificationPlan(incidentId: string | undefined) {
  return useQuery({
    queryKey: ['incident-verification-plan', incidentId],
    queryFn: () => fetchIncidentVerificationPlan(incidentId!),
    enabled: Boolean(incidentId),
  })
}
