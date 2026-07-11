import { authFetch } from '@/core/auth/auth-fetch'

export interface ResponseListItemDto {
  incident_id: string
  assessment_id: string
  decision_id: string | null
  recommended_level: string
  urgency: string
  assessment_status: string
  decision_status: string
  primary_action: string | null
  owner_id: string | null
  next_milestone: string | null
  badge: string
  updated_at: string
}

export interface ResponseExecutiveItemDto {
  incident_id: string
  recommended_level: string
  urgency: string
  decision_status: string
  primary_action: string | null
  badge: string
  blocking_uncertainties: unknown
  closure_recommendation: string
  updated_at: string
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(path, init)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json() as Promise<T>
}

export function fetchResponses(filter?: string) {
  const qs = filter ? `?filter=${encodeURIComponent(filter)}` : ''
  return apiFetch<{ items: ResponseListItemDto[]; generated_at: string }>(`/api/responses${qs}`)
}

export function fetchResponseExecutiveSummary() {
  return apiFetch<{
    items: ResponseExecutiveItemDto[]
    summary: Record<string, number>
    generated_at: string
  }>('/api/responses/executive-summary')
}

export function fetchResponseDetail(incidentId: string) {
  return apiFetch<Record<string, unknown>>(`/api/responses/${incidentId}`)
}

export function fetchResponseBriefing(incidentId: string) {
  return apiFetch<Record<string, unknown>>(`/api/responses/${incidentId}/briefing`)
}

export function fetchResponseHistory(incidentId: string) {
  return apiFetch<{ items: unknown[]; generated_at: string }>(`/api/responses/${incidentId}/history`)
}

export function approveDecision(decisionId: string) {
  return apiFetch<Record<string, unknown>>(`/api/responses/decisions/${decisionId}/approve`, {
    method: 'POST',
  })
}

export function rejectDecision(decisionId: string, rationale: string) {
  return apiFetch<Record<string, unknown>>(`/api/responses/decisions/${decisionId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rationale }),
  })
}

export function modifyDecision(
  decisionId: string,
  input: { modified_decision: string; rationale: string; updated_at?: string },
) {
  return apiFetch<Record<string, unknown>>(`/api/responses/decisions/${decisionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
