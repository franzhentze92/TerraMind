import { useQuery } from '@tanstack/react-query'
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
  return useQuery({
    queryKey: ['incidents', filters],
    queryFn: () => fetchIncidents(filters),
  })
}

export function useIncidentDetail(incidentId?: string) {
  return useQuery({
    queryKey: ['incident', incidentId],
    queryFn: () => fetchIncidentDetail(incidentId!),
    enabled: Boolean(incidentId),
  })
}

export function useIncidentHistory(incidentId?: string) {
  return useQuery({
    queryKey: ['incident-history', incidentId],
    queryFn: () => fetchIncidentHistory(incidentId!),
    enabled: Boolean(incidentId),
  })
}

export function useFireEventIncident(eventId?: string) {
  return useQuery({
    queryKey: ['fire-event-incident', eventId],
    queryFn: () => fetchFireEventIncident(eventId!),
    enabled: Boolean(eventId),
  })
}
