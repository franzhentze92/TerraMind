import type {
  CorrelationEvaluationResult,
  IncidentPriorityResult,
  IncidentStatus,
  MembershipRole,
  PrimaryEventSelection,
} from '@/modules/incidents/incidents.types'
import {
  FIRE_INCIDENT_CORRELATION_MODEL_VERSION,
  FIRE_INCIDENT_DOMAIN,
  FIRE_INCIDENT_PRIORITY_MODEL_VERSION,
  FIRE_INCIDENT_TYPE,
} from '@/modules/incidents/config/fire-incident-correlation.config'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export interface IncidentRow {
  id: string
  incident_type: string
  domain: string
  status: IncidentStatus
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
  verification_status: string
  attention_score: number
  verification_score: number
  action_score: number
  attention_level: string
  verification_level: string
  action_level: string
  priority_explanation: Record<string, unknown>
  priority_limitations: string[]
  correlation_summary: Record<string, unknown>
  priority_model_version: string | null
  correlation_model_version: string
  merged_into_incident_id: string | null
  split_from_incident_id: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export async function getIncidentById(id: string): Promise<IncidentRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('incidents').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as IncidentRow | null) ?? null
}

export async function createIncident(input: {
  eventId: string
  eventType: string
  firstObservedAt: string
  lastObservedAt: string
  centroidLat: number | null
  centroidLng: number | null
  sourceTypes: string[]
  priority: IncidentPriorityResult
  correlationSummary: Record<string, unknown>
}): Promise<string> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('incidents')
    .insert({
      incident_type: FIRE_INCIDENT_TYPE,
      domain: FIRE_INCIDENT_DOMAIN,
      status: 'open',
      primary_event_type: input.eventType,
      primary_event_id: input.eventId,
      first_observed_at: input.firstObservedAt,
      last_observed_at: input.lastObservedAt,
      centroid_lat: input.centroidLat,
      centroid_lng: input.centroidLng,
      event_count: 1,
      active_event_count: 1,
      source_types: input.sourceTypes,
      evidence_status: input.priority.evidence_status,
      verification_status: 'unverified',
      attention_score: input.priority.attention_score,
      verification_score: input.priority.verification_score,
      action_score: input.priority.action_score,
      attention_level: input.priority.attention_level,
      verification_level: input.priority.verification_level,
      action_level: input.priority.action_level,
      priority_explanation: input.priority.priority_explanation,
      priority_limitations: input.priority.priority_limitations,
      correlation_summary: input.correlationSummary,
      priority_model_version: FIRE_INCIDENT_PRIORITY_MODEL_VERSION,
      correlation_model_version: FIRE_INCIDENT_CORRELATION_MODEL_VERSION,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return String(data.id)
}

export async function updateIncidentAggregates(
  incidentId: string,
  input: {
    status: IncidentStatus
    primary: PrimaryEventSelection
    members: Array<{ first_detected_at: string; last_detected_at: string; source_products: string[] }>
    priority: IncidentPriorityResult
    correlationSummary?: Record<string, unknown>
    resolvedAt?: string | null
  },
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const firstObserved = input.members.reduce(
    (min, m) => (m.first_detected_at < min ? m.first_detected_at : min),
    input.members[0]?.first_detected_at ?? now,
  )
  const lastObserved = input.members.reduce(
    (max, m) => (m.last_detected_at > max ? m.last_detected_at : max),
    input.members[0]?.last_detected_at ?? now,
  )
  const sourceTypes = [
    ...new Set(input.members.flatMap((m) => m.source_products.map((p) => p.split('_')[0] ?? p))),
  ]

  const { error } = await supabase
    .from('incidents')
    .update({
      status: input.status,
      primary_event_type: input.primary.event_type,
      primary_event_id: input.primary.event_id,
      first_observed_at: firstObserved,
      last_observed_at: lastObserved,
      event_count: input.members.length,
      active_event_count: input.members.length,
      source_types: sourceTypes,
      evidence_status: input.priority.evidence_status,
      attention_score: input.priority.attention_score,
      verification_score: input.priority.verification_score,
      action_score: input.priority.action_score,
      attention_level: input.priority.attention_level,
      verification_level: input.priority.verification_level,
      action_level: input.priority.action_level,
      priority_explanation: input.priority.priority_explanation,
      priority_limitations: input.priority.priority_limitations,
      correlation_summary: input.correlationSummary ?? {},
      priority_model_version: FIRE_INCIDENT_PRIORITY_MODEL_VERSION,
      correlation_model_version: FIRE_INCIDENT_CORRELATION_MODEL_VERSION,
      resolved_at: input.resolvedAt ?? null,
      updated_at: now,
    })
    .eq('id', incidentId)
  if (error) throw new Error(error.message)
}

export async function listIncidents(filters: {
  status?: string
  attention_level?: string
  limit?: number
}): Promise<IncidentRow[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('incidents')
    .select('*')
    .not('status', 'eq', 'merged')
    .order('attention_score', { ascending: false })
    .limit(filters.limit ?? 100)

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.attention_level) query = query.eq('attention_level', filters.attention_level)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data as IncidentRow[]) ?? []
}

export async function countIncidentsByStatus(): Promise<Record<string, number>> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('incidents').select('status')
  if (error) throw new Error(error.message)
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const s = String(row.status)
    counts[s] = (counts[s] ?? 0) + 1
  }
  return counts
}

export async function getIncidentForFireEvent(eventId: string): Promise<IncidentRow | null> {
  const supabase = getSupabaseAdmin()
  const { data: membership, error: mErr } = await supabase
    .from('incident_event_memberships')
    .select('incident_id')
    .eq('event_type', 'fire_event')
    .eq('event_id', eventId)
    .eq('membership_status', 'active')
    .maybeSingle()
  if (mErr) throw new Error(mErr.message)
  if (!membership) return null
  return getIncidentById(String(membership.incident_id))
}
