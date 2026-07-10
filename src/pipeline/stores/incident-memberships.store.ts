import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import type { MembershipRole, MembershipStatus } from '@/modules/incidents/incidents.types'
import { FIRE_INCIDENT_CORRELATION_MODEL_VERSION } from '@/modules/incidents/config/fire-incident-correlation.config'

export interface MembershipRow {
  id: string
  incident_id: string
  event_type: string
  event_id: string
  membership_status: MembershipStatus
  membership_role: MembershipRole
  correlation_score: number
  correlation_reasons: string[]
  joined_at: string
  left_at: string | null
  correlation_model_version: string
  created_at: string
  updated_at: string
}

export async function getActiveMembershipForEvent(
  eventType: string,
  eventId: string,
): Promise<MembershipRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('incident_event_memberships')
    .select('*')
    .eq('event_type', eventType)
    .eq('event_id', eventId)
    .eq('membership_status', 'active')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as MembershipRow | null) ?? null
}

export async function listMembershipsForIncident(
  incidentId: string,
): Promise<MembershipRow[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('incident_event_memberships')
    .select('*')
    .eq('incident_id', incidentId)
    .order('joined_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as MembershipRow[]) ?? []
}

export async function insertMembership(input: {
  incidentId: string
  eventType: string
  eventId: string
  role: MembershipRole
  correlationScore: number
  correlationReasons: string[]
}): Promise<string> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('incident_event_memberships')
    .insert({
      incident_id: input.incidentId,
      event_type: input.eventType,
      event_id: input.eventId,
      membership_status: 'active',
      membership_role: input.role,
      correlation_score: input.correlationScore,
      correlation_reasons: input.correlationReasons,
      joined_at: now,
      correlation_model_version: FIRE_INCIDENT_CORRELATION_MODEL_VERSION,
      updated_at: now,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  await recordMembershipHistory({
    incidentId: input.incidentId,
    eventType: input.eventType,
    eventId: input.eventId,
    action: 'joined',
    newStatus: 'active',
    newRole: input.role,
    correlationScore: input.correlationScore,
    correlationReasons: input.correlationReasons,
  })

  return String(data.id)
}

export async function updateMembershipStatus(input: {
  membershipId: string
  incidentId: string
  eventType: string
  eventId: string
  status: MembershipStatus
  role?: MembershipRole
  reasons?: string[]
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    membership_status: input.status,
    updated_at: now,
  }
  if (input.status !== 'active') patch.left_at = now
  if (input.role) patch.membership_role = input.role

  const { error } = await supabase
    .from('incident_event_memberships')
    .update(patch)
    .eq('id', input.membershipId)
  if (error) throw new Error(error.message)

  await recordMembershipHistory({
    incidentId: input.incidentId,
    eventType: input.eventType,
    eventId: input.eventId,
    action: input.status === 'historical' ? 'left' : 'role_changed',
    newStatus: input.status,
    newRole: input.role,
    correlationReasons: input.reasons ?? [],
  })
}

export async function recordMembershipHistory(input: {
  incidentId: string
  eventType: string
  eventId: string
  action: string
  previousStatus?: string | null
  newStatus?: string | null
  previousRole?: string | null
  newRole?: string | null
  correlationScore?: number
  correlationReasons?: string[]
  evidenceSnapshot?: Record<string, unknown>
  relatedIncidentId?: string | null
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('incident_membership_history').insert({
    incident_id: input.incidentId,
    event_type: input.eventType,
    event_id: input.eventId,
    action: input.action,
    previous_status: input.previousStatus ?? null,
    new_status: input.newStatus ?? null,
    previous_role: input.previousRole ?? null,
    new_role: input.newRole ?? null,
    correlation_score: input.correlationScore ?? null,
    correlation_reasons: input.correlationReasons ?? [],
    evidence_snapshot: input.evidenceSnapshot ?? {},
    related_incident_id: input.relatedIncidentId ?? null,
    correlation_model_version: FIRE_INCIDENT_CORRELATION_MODEL_VERSION,
  })
  if (error) throw new Error(error.message)
}

export async function listMembershipHistory(
  incidentId: string,
  limit = 100,
): Promise<Array<Record<string, unknown>>> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('incident_membership_history')
    .select('*')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data as Array<Record<string, unknown>>) ?? []
}
