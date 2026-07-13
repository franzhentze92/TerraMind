import { useQuery } from '@tanstack/react-query'
import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import {
  fetchExecutiveDashboard,
  fetchIncidentReport,
  fetchIncidentStory,
  fetchNationalReport,
} from '../api/executive-demo-api'

export function useExecutiveDashboard(includeDemo = false, periodHours = 48) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['executive-dashboard', includeDemo, periodHours],
    queryFn: () => fetchExecutiveDashboard(includeDemo, periodHours),
    staleTime: 30_000,
    enabled: authReady,
  })
}

export function useIncidentStory(incidentId: string | undefined, includeDemo = false) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['incident-story', incidentId, includeDemo],
    queryFn: () => fetchIncidentStory(incidentId!, includeDemo),
    enabled: authReady && Boolean(incidentId),
  })
}

export function useNationalReport(period: string, includeDemo = false) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['national-report', period, includeDemo],
    queryFn: () => fetchNationalReport(period, includeDemo),
    enabled: authReady,
  })
}

export function useIncidentReport(incidentId: string | undefined, includeDemo = false) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['incident-report', incidentId, includeDemo],
    queryFn: () => fetchIncidentReport(incidentId!, includeDemo),
    enabled: authReady && Boolean(incidentId),
  })
}
