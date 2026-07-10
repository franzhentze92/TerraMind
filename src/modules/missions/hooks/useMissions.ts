import { useQuery } from '@tanstack/react-query'
import { fetchIncidentMissions, fetchMissionDetail, fetchMissions } from '../api/missions-api'

export function useMissionsList(filters: Record<string, string | undefined> = {}) {
  return useQuery({
    queryKey: ['missions', filters],
    queryFn: () => fetchMissions(filters),
  })
}

export function useMissionDetail(missionId: string | undefined) {
  return useQuery({
    queryKey: ['mission', missionId],
    queryFn: () => fetchMissionDetail(missionId!),
    enabled: Boolean(missionId),
  })
}

export function useIncidentMissions(incidentId: string | undefined) {
  return useQuery({
    queryKey: ['incident-missions', incidentId],
    queryFn: () => fetchIncidentMissions(incidentId!),
    enabled: Boolean(incidentId),
  })
}
