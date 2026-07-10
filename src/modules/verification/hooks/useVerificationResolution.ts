import { useQuery } from '@tanstack/react-query'
import {
  fetchIncidentVerificationResolution,
  fetchPlanResolutionSummary,
} from '../api/verification-api'

export function useIncidentVerificationResolution(incidentId: string | undefined) {
  return useQuery({
    queryKey: ['incident-verification-resolution', incidentId],
    queryFn: () => fetchIncidentVerificationResolution(incidentId!),
    enabled: Boolean(incidentId),
  })
}

export function usePlanResolutionSummary(planId: string | undefined) {
  return useQuery({
    queryKey: ['plan-resolution-summary', planId],
    queryFn: () => fetchPlanResolutionSummary(planId!),
    enabled: Boolean(planId),
  })
}
