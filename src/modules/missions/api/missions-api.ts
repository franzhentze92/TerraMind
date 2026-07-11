import { authFetch } from '@/core/auth/auth-fetch'

export interface MissionSummaryDto {
  id: string
  mission_type: string
  title: string
  status: string
  classification?: 'operational' | 'demo'
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
  const res = await authFetch(path)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json() as Promise<T>
}

export function fetchMissions(params: Record<string, string | undefined> = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v)
  }
  const suffix = qs.toString() ? `?${qs}` : ''
  return apiFetch<{ items: MissionSummaryDto[]; demo_excluded?: number; generated_at: string }>(
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

export type MissionWorkflowAction =
  | 'assign'
  | 'accept'
  | 'decline'
  | 'start'
  | 'block'
  | 'resume'
  | 'reassign'
  | 'complete'
  | 'cancel'

export interface MissionWorkflowPayload {
  assignee_type?: 'user' | 'team' | 'organization' | 'external_actor'
  assignee_id?: string
  organization_id?: string
  reason?: string
  idempotency_key?: string
  override_compatibility?: boolean
  explicit_inconclusive?: boolean
  actor_id?: string
}

export interface MissionWorkflowResult {
  ok: boolean
  action: string
  mission_status: string
  assignment_status: string | null
  assignment_id: string | null
  reasons: string[]
  warnings: string[]
  idempotent_replay: boolean
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `API error ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function postMissionWorkflow(
  missionId: string,
  action: MissionWorkflowAction,
  payload: MissionWorkflowPayload = {},
) {
  return apiPost<MissionWorkflowResult>(
    `/api/operations/missions/${missionId}/${action}`,
    payload,
  )
}
