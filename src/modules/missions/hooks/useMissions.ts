import { useQuery } from '@tanstack/react-query'
import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import { fetchIncidentMissions, fetchMissionDetail, fetchMissions } from '../api/missions-api'

export function useMissionsList(filters: Record<string, string | undefined> = {}) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['missions', filters],
    queryFn: () => fetchMissions(filters),
    enabled: authReady,
  })
}

export function useMissionDetail(missionId: string | undefined) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['mission', missionId],
    queryFn: () => fetchMissionDetail(missionId!),
    enabled: authReady && Boolean(missionId),
  })
}

export function useIncidentMissions(incidentId: string | undefined) {
  const authReady = useAuthQueryReady()
  return useQuery({
    queryKey: ['incident-missions', incidentId],
    queryFn: () => fetchIncidentMissions(incidentId!),
    enabled: authReady && Boolean(incidentId),
  })
}
