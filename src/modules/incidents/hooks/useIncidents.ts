import { useQuery } from '@tanstack/react-query'
import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import {
  fetchFireEventIncident,
  fetchIncidentDetail,
  fetchIncidentHistory,
  fetchIncidents,
} from '../api/incidents-api'

export function useIncidentsList(filters: {
  status?: string
  attention_level?: string
} = {}) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['incidents', filters],
    queryFn: () => fetchIncidents(filters),
    enabled: authReady,
  })
}

export function useIncidentDetail(incidentId?: string) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['incident', incidentId],
    queryFn: () => fetchIncidentDetail(incidentId!),
    enabled: authReady && Boolean(incidentId),
  })
}

export function useIncidentHistory(incidentId?: string) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['incident-history', incidentId],
    queryFn: () => fetchIncidentHistory(incidentId!),
    enabled: authReady && Boolean(incidentId),
  })
}

export function useFireEventIncident(eventId?: string) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['fire-event-incident', eventId],
    queryFn: () => fetchFireEventIncident(eventId!),
    enabled: authReady && Boolean(eventId),
  })
}
