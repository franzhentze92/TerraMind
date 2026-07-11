import { authFetch } from '@/core/auth/auth-fetch'

export interface VerificationPlanSummaryDto {
  id: string
  incident_id: string
  incident_status: string | null
  incident_type?: string | null
  incident_display_name?: string | null
  classification?: 'operational' | 'legacy' | 'demo'
  domain: string | null
  status: string
  plan_priority: number
  primary_need_type: string | null
  primary_need_question: string | null
  recommended_method_id: string | null
  recommended_method_label: string | null
  requires_field: boolean
  requires_external_provider: boolean
  recommended_window: Record<string, unknown>
  needs_count: number
  methods_count: number
  mission_candidate_pending: boolean
  created_at: string
  updated_at: string
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await authFetch(path)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json() as Promise<T>
}

export function fetchVerificationPlans(params: Record<string, string | undefined> = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v)
  }
  const suffix = qs.toString() ? `?${qs}` : ''
  return apiFetch<{ items: VerificationPlanSummaryDto[]; generated_at: string }>(
    `/api/intelligence/verification-plans${suffix}`,
  )
}

export function fetchVerificationPlanDetail(id: string) {
  return apiFetch<Record<string, unknown>>(`/api/intelligence/verification-plans/${id}`)
}

export function fetchIncidentVerificationPlan(incidentId: string) {
  return apiFetch<Record<string, unknown>>(
    `/api/intelligence/incidents/${incidentId}/verification-plan`,
  )
}

export function fetchIncidentVerificationNeeds(incidentId: string) {
  return apiFetch<{ items: unknown[]; plan_id?: string; plan_status?: string; generated_at: string }>(
    `/api/intelligence/incidents/${incidentId}/verification-needs`,
  )
}

export function fetchNeedResolution(needId: string) {
  return apiFetch<Record<string, unknown>>(
    `/api/intelligence/verification-needs/${needId}/resolution`,
  )
}

export function fetchIncidentVerificationResolution(incidentId: string) {
  return apiFetch<Record<string, unknown>>(
    `/api/intelligence/incidents/${incidentId}/verification-resolution`,
  )
}

export function fetchPlanResolutionSummary(planId: string) {
  return apiFetch<Record<string, unknown>>(
    `/api/intelligence/verification-plans/${planId}/resolution-summary`,
  )
}

export function fetchMissionResolutionContributions(missionId: string) {
  return apiFetch<{ items: unknown[]; generated_at: string }>(
    `/api/operations/missions/${missionId}/resolution-contributions`,
  )
}
