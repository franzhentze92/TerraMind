export interface PriorityListItemDto {
  id: string
  entity_type: string
  entity_id: string
  department_name: string | null
  attention_score: number
  verification_score: number
  action_score: number
  attention_level: string
  verification_level: string
  action_level: string
  priority_reasons: string[]
  priority_limitations: string[]
  recommended_next_step: string
  dominant_domains: string[]
  evaluated_at: string
  valid_until: string
  assessment_status: string
}

export interface PriorityDetailDto extends PriorityListItemDto {
  severity_component: number
  urgency_component: number
  exposure_component: number
  sensitivity_component: number
  confidence_component: number
  persistence_component: number
  domain_contributions: Record<string, number>
  score_explanation: Record<string, unknown>
  priority_limitations: string[]
  finding_snapshot: Array<{
    finding_id: string
    finding_type: string
    title: string
    contributed: boolean
    accepted_contribution: number
    discard_reason?: string
  }>
  change_reasons: string[]
  score_delta: Record<string, number>
  level_change: Record<string, unknown>
  recommended_next_step: string
  context_version: string
  rule_set_version: string
  priority_model_version: string
  history: Array<{
    id: string
    attention_score: number
    attention_level: string
    evaluated_at: string
    assessment_status: string
  }>
}

import { authFetch } from '@/core/auth/auth-fetch'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await authFetch(path)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json() as Promise<T>
}

export function fetchPrioritiesList(params: Record<string, string | undefined> = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v)
  }
  const query = qs.toString()
  return apiFetch<{ items: PriorityListItemDto[]; generated_at: string }>(
    `/api/intelligence/priorities${query ? `?${query}` : ''}`,
  )
}

export function fetchPriorityDetail(id: string) {
  return apiFetch<PriorityDetailDto>(`/api/intelligence/priorities/${id}`)
}

export function fetchFireEventPriority(eventId: string) {
  return apiFetch<{ assessment: PriorityDetailDto | null; generated_at: string }>(
    `/api/environment/fires/events/${eventId}/priority`,
  )
}
