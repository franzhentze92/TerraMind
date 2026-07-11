export interface LifecycleSummaryDto {
  entity_type: string
  entity_id: string
  lifecycle_state: string | null
  lifecycle_model_version: string | null
  state_changed_at: string | null
  first_detected_at: string | null
  last_detected_at: string | null
  inactive_since: string | null
  monitoring_until: string | null
  resolved_at: string | null
  reactivated_at: string | null
  time_in_state_hours: number | null
  latest_transition: {
    id: string
    previous_state: string | null
    new_state: string
    transition_reason: string
    transition_rule: string | null
    evaluated_at: string
  } | null
}

export interface LifecycleTransitionDto {
  id: string
  previous_state: string | null
  new_state: string
  transitioned: boolean
  transition_reason: string
  transition_rule: string | null
  evidence_snapshot: Record<string, unknown>
  source_detection_ids: string[]
  lifecycle_model_version: string
  evaluated_at: string
}

import { authFetch } from '@/core/auth/auth-fetch'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await authFetch(path)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json() as Promise<T>
}

export function fetchEntityLifecycle(entityType: string, entityId: string) {
  return apiFetch<LifecycleSummaryDto>(
    `/api/intelligence/events/${entityType}/${entityId}/lifecycle`,
  )
}

export function fetchEntityLifecycleTransitions(entityType: string, entityId: string) {
  return apiFetch<{ items: LifecycleTransitionDto[]; generated_at: string }>(
    `/api/intelligence/events/${entityType}/${entityId}/transitions`,
  )
}
