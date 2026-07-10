export interface MissionSummaryDto {
  id: string
  mission_type: string
  title: string
  status: string
  incident_id: string
  incident_status: string | null
  verification_plan_id: string
  priority: number
  recommended_method_code: string
  due_at: string
  expires_at: string
  task_count: number
  required_evidence_count: number
  blocking_conditions: unknown[]
  created_at: string
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'include' })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json() as Promise<T>
}

export function fetchMissions(params: Record<string, string | undefined> = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v)
  }
  const suffix = qs.toString() ? `?${qs}` : ''
  return apiFetch<{ items: MissionSummaryDto[]; generated_at: string }>(
    `/api/operations/missions${suffix}`,
  )
}

export function fetchMissionDetail(id: string) {
  return apiFetch<Record<string, unknown>>(`/api/operations/missions/${id}`)
}

export function fetchIncidentMissions(incidentId: string) {
  return apiFetch<{ items: MissionSummaryDto[]; generated_at: string }>(
    `/api/intelligence/incidents/${incidentId}/missions`,
  )
}

export function fetchVerificationPlanMissions(planId: string) {
  return apiFetch<{ items: MissionSummaryDto[]; generated_at: string }>(
    `/api/intelligence/verification-plans/${planId}/missions`,
  )
}
