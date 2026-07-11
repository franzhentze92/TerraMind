export interface IncidentSummaryDto {
  id: string
  incident_type: string
  domain: string
  status: string
  primary_event_type: string | null
  primary_event_id: string | null
  first_observed_at: string
  last_observed_at: string
  centroid_lat: number | null
  centroid_lng: number | null
  event_count: number
  active_event_count: number
  source_types: string[]
  evidence_status: string
  attention_score: number
  verification_score: number
  action_score: number
  attention_level: string
  verification_level: string
  action_level: string
  correlation_model_version: string
  resolved_at: string | null
  created_at: string
  updated_at: string
}

import { authFetch } from '@/core/auth/auth-fetch'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await authFetch(path)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json() as Promise<T>
}

export function fetchIncidents(params: Record<string, string | undefined> = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v)
  }
  const suffix = qs.toString() ? `?${qs}` : ''
  return apiFetch<{ items: IncidentSummaryDto[]; generated_at: string }>(
    `/api/intelligence/incidents${suffix}`,
  )
}

export function fetchIncidentDetail(id: string) {
  return apiFetch<IncidentSummaryDto & Record<string, unknown>>(
    `/api/intelligence/incidents/${id}`,
  )
}

export function fetchIncidentEvents(id: string) {
  return apiFetch<{ items: unknown[]; generated_at: string }>(
    `/api/intelligence/incidents/${id}/events`,
  )
}

export function fetchIncidentHistory(id: string) {
  return apiFetch<{ items: unknown[]; generated_at: string }>(
    `/api/intelligence/incidents/${id}/history`,
  )
}

export function fetchFireEventIncident(eventId: string) {
  return apiFetch<{
    incident: IncidentSummaryDto | null
    recent_evaluations: unknown[]
    generated_at: string
  }>(`/api/environment/fires/events/${eventId}/incident`)
}
