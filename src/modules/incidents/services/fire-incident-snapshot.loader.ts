import type { IncidentEventSnapshot, IncidentCandidateSnapshot } from '@/modules/incidents/incidents.types'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import { getActivePriorityAssessment } from '@/pipeline/stores/priority-assessments.store'
import { mapPriorityRowToAssessment } from '@/pipeline/stores/priority-assessments.store'
import { FIRE_INCIDENT_CORRELATION_MODEL_VERSION } from '@/modules/incidents/config/fire-incident-correlation.config'

export async function loadFireEventIncidentSnapshot(
  eventId: string,
): Promise<IncidentEventSnapshot | null> {
  const supabase = getSupabaseAdmin()
  const { data: event, error } = await supabase
    .from('fire_events')
    .select(
      `
      id, status, validation_status, lifecycle_state,
      centroid_lat, centroid_lng, first_detected_at, last_detected_at,
      detection_count, persistence_hours, estimated_area_ha, source_products,
      department_id, geo_departments!fire_events_department_id_fkey (name)
    `,
    )
    .eq('id', eventId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!event) return null

  const priorityRow = await getActivePriorityAssessment('fire_event', eventId)
  const priority = priorityRow ? mapPriorityRowToAssessment(priorityRow) : null

  const { data: membership } = await supabase
    .from('incident_event_memberships')
    .select('incident_id, membership_status')
    .eq('event_type', 'fire_event')
    .eq('event_id', eventId)
    .eq('membership_status', 'active')
    .maybeSingle()

  const deptRaw = event.geo_departments as { name?: string } | { name?: string }[] | null
  const dept = Array.isArray(deptRaw) ? deptRaw[0] : deptRaw

  return {
    event_type: 'fire_event',
    event_id: String(event.id),
    lifecycle_state: event.lifecycle_state ? String(event.lifecycle_state) : null,
    validation_status: String(event.validation_status ?? 'no_validado'),
    status: String(event.status),
    department_id: event.department_id ? String(event.department_id) : null,
    department_name: dept?.name ?? null,
    centroid_lat: event.centroid_lat != null ? Number(event.centroid_lat) : null,
    centroid_lng: event.centroid_lng != null ? Number(event.centroid_lng) : null,
    first_detected_at: String(event.first_detected_at),
    last_detected_at: String(event.last_detected_at),
    detection_count: Number(event.detection_count ?? 0),
    persistence_hours: event.persistence_hours != null ? Number(event.persistence_hours) : null,
    estimated_area_ha: event.estimated_area_ha != null ? Number(event.estimated_area_ha) : null,
    source_products: (event.source_products as string[] | null) ?? [],
    attention_score: priority?.attention_score ?? null,
    verification_score: priority?.verification_score ?? null,
    action_score: priority?.action_score ?? null,
    attention_level: priority?.attention_level ?? null,
    verification_level: priority?.verification_level ?? null,
    action_level: priority?.action_level ?? null,
    active_incident_id: membership?.incident_id ? String(membership.incident_id) : null,
    membership_status: membership?.membership_status
      ? String(membership.membership_status)
      : null,
  }
}

export async function listFireEventCandidatesForIncidentCorrelation(
  limit = 10000,
): Promise<Array<{ id: string }>> {
  const { listFireEventCandidatesForLifecycle } = await import(
    '@/modules/lifecycle/services/fire-lifecycle-snapshot.loader'
  )
  return listFireEventCandidatesForLifecycle(limit)
}

export async function listPeerFireEventSnapshots(
  excludeEventId: string,
  limit = 200,
): Promise<IncidentEventSnapshot[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('fire_events')
    .select('id')
    .neq('id', excludeEventId)
    .order('last_detected_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)

  const snapshots: IncidentEventSnapshot[] = []
  for (const row of data ?? []) {
    const snap = await loadFireEventIncidentSnapshot(String(row.id))
    if (snap) snapshots.push(snap)
  }
  return snapshots
}

export async function listCandidateIncidentSnapshots(
  excludeIncidentId?: string,
): Promise<IncidentCandidateSnapshot[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('incidents')
    .select(
      'id, status, primary_event_id, centroid_lat, centroid_lng, first_observed_at, last_observed_at, active_event_count',
    )
    .in('status', ['open', 'monitoring'])
    .order('last_observed_at', { ascending: false })

  if (excludeIncidentId) query = query.neq('id', excludeIncidentId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const results: IncidentCandidateSnapshot[] = []
  for (const row of data ?? []) {
    const { data: members } = await supabase
      .from('incident_event_memberships')
      .select('event_id')
      .eq('incident_id', row.id)
      .eq('membership_status', 'active')

    results.push({
      incident_id: String(row.id),
      status: row.status as IncidentCandidateSnapshot['status'],
      primary_event_id: row.primary_event_id ? String(row.primary_event_id) : null,
      centroid_lat: row.centroid_lat != null ? Number(row.centroid_lat) : null,
      centroid_lng: row.centroid_lng != null ? Number(row.centroid_lng) : null,
      first_observed_at: String(row.first_observed_at),
      last_observed_at: String(row.last_observed_at),
      active_event_count: Number(row.active_event_count ?? 0),
      member_event_ids: (members ?? []).map((m) => String(m.event_id)),
    })
  }
  return results
}

export async function loadIncidentMemberSnapshots(
  incidentId: string,
): Promise<IncidentEventSnapshot[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('incident_event_memberships')
    .select('event_id, membership_status')
    .eq('incident_id', incidentId)
    .in('membership_status', ['active', 'historical'])
  if (error) throw new Error(error.message)

  const snapshots: IncidentEventSnapshot[] = []
  for (const row of data ?? []) {
    const snap = await loadFireEventIncidentSnapshot(String(row.event_id))
    if (snap) {
      snapshots.push({
        ...snap,
        membership_status: row.membership_status as IncidentEventSnapshot['membership_status'],
      })
    }
  }
  return snapshots
}

export { FIRE_INCIDENT_CORRELATION_MODEL_VERSION }
