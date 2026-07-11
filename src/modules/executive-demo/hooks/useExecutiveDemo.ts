import { useQuery } from '@tanstack/react-query'
import {
  fetchExecutiveDashboard,
  fetchIncidentReport,
  fetchIncidentStory,
  fetchNationalReport,
} from '../api/executive-demo-api'

export function useExecutiveDashboard(includeDemo = false) {
  return useQuery({
    queryKey: ['executive-dashboard', includeDemo],
    queryFn: () => fetchExecutiveDashboard(includeDemo),
    staleTime: 30_000,
  })
}

export function useIncidentStory(incidentId: string | undefined, includeDemo = false) {
  return useQuery({
    queryKey: ['incident-story', incidentId, includeDemo],
    queryFn: () => fetchIncidentStory(incidentId!, includeDemo),
    enabled: Boolean(incidentId),
  })
}

export function useNationalReport(period: string, includeDemo = false) {
  return useQuery({
    queryKey: ['national-report', period, includeDemo],
    queryFn: () => fetchNationalReport(period, includeDemo),
  })
}

export function useIncidentReport(incidentId: string | undefined, includeDemo = false) {
  return useQuery({
    queryKey: ['incident-report', incidentId, includeDemo],
    queryFn: () => fetchIncidentReport(incidentId!, includeDemo),
    enabled: Boolean(incidentId),
  })
}
