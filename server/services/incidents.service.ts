import type { RequestAuthContext } from '@/core/auth/permissions'
import {
  getIncidentById,
  getIncidentForFireEvent,
  listIncidents,
} from '@/pipeline/stores/incidents.store'
import {
  listMembershipHistory,
  listMembershipsForIncident,
} from '@/pipeline/stores/incident-memberships.store'
import { listCorrelationRunsForEvent } from '@/pipeline/stores/incident-correlation-runs.store'
import { loadFireEventIncidentSnapshot } from '@/modules/incidents/services/fire-incident-snapshot.loader'
import { isInternalDemoIncidentId } from '@/modules/executive-demo/demo-config'
import type { DataClassification } from '@/modules/executive-metrics/metric-taxonomy'

/**
 * Classify an incident for the list. Legacy (null org) is national data (RLS
 * allows it) and stays visible to authorized users, badged — never silently
 * dropped or summed as operational.
 */
function classifyIncident(
  row: { id: string; organization_id?: string | null },
  auth?: RequestAuthContext,
): DataClassification | 'out_of_scope' {
  const id = String(row.id)
  const orgId = row.organization_id ?? null
  if (isInternalDemoIncidentId(id)) return 'demo'
  if (orgId == null) return 'legacy'
  if (!auth || auth.isPlatformAdmin || orgId === auth.activeOrganizationId) return 'operational'
  return 'out_of_scope'
}

export async function listIncidentsDto(
  filters: {
  status?: string
  attention_level?: string
  verification_level?: string
  domain?: string
  limit?: number
  include_demo?: boolean
  },
  auth?: RequestAuthContext,
) {
  const rows = (await listIncidents({
    status: filters.status,
    attention_level: filters.attention_level,
    limit: filters.limit ?? 100,
  })) as Array<Awaited<ReturnType<typeof getIncidentById>> & { organization_id?: string | null }>

  let items = rows
    .map((row) => ({ row, classification: classifyIncident(row, auth) }))
    .filter((x) => x.classification !== 'out_of_scope')
    .filter((x) => (filters.include_demo ? true : x.classification !== 'demo'))
  if (filters.verification_level) {
    items = items.filter((x) => x.row!.verification_level === filters.verification_level)
  }
  if (filters.domain) items = items.filter((x) => x.row!.domain === filters.domain)

  return {
    items: items.map((x) => mapIncidentSummary(x.row!, x.classification as DataClassification)),
    generated_at: new Date().toISOString(),
  }
}

export async function getIncidentDetail(id: string) {
  const incident = await getIncidentById(id)
  if (!incident) return null
  const memberships = await listMembershipsForIncident(id)
  const history = await listMembershipHistory(id, 50)

  const memberDetails = []
  for (const m of memberships) {
    const snap = await loadFireEventIncidentSnapshot(m.event_id)
    memberDetails.push({
      membership_id: m.id,
      event_type: m.event_type,
      event_id: m.event_id,
      membership_status: m.membership_status,
      membership_role: m.membership_role,
      correlation_score: m.correlation_score,
      correlation_reasons: m.correlation_reasons,
      joined_at: m.joined_at,
      left_at: m.left_at,
      lifecycle_state: snap?.lifecycle_state ?? null,
      attention_score: snap?.attention_score ?? null,
      department_name: snap?.department_name ?? null,
      last_detected_at: snap?.last_detected_at ?? null,
    })
  }

  return {
    ...mapIncidentSummary(incident),
    priority_explanation: incident.priority_explanation,
    priority_limitations: incident.priority_limitations,
    correlation_summary: incident.correlation_summary,
    members: memberDetails,
    history,
    generated_at: new Date().toISOString(),
  }
}

export async function getIncidentEvents(id: string) {
  const detail = await getIncidentDetail(id)
  if (!detail) return null
  return { items: detail.members, generated_at: detail.generated_at }
}

export async function getIncidentHistory(id: string) {
  const history = await listMembershipHistory(id, 100)
  return { items: history, generated_at: new Date().toISOString() }
}

export async function getFireEventIncident(eventId: string) {
  const incident = await getIncidentForFireEvent(eventId)
  if (!incident) return null
  const runs = await listCorrelationRunsForEvent('fire_event', eventId, 5)
  return {
    incident: mapIncidentSummary(incident),
    recent_evaluations: runs.map((r) => ({
      correlation_decision: r.correlation_decision,
      correlation_score: r.correlation_score,
      correlation_reasons: r.correlation_reasons,
      rejected_reasons: r.rejected_reasons,
      evaluated_at: r.evaluated_at,
    })),
    generated_at: new Date().toISOString(),
  }
}

function mapIncidentSummary(
  incident: Awaited<ReturnType<typeof getIncidentById>> & { organization_id?: string | null },
  classification: DataClassification = 'operational',
) {
  return {
    id: incident.id,
    incident_type: incident.incident_type,
    domain: incident.domain,
    status: incident.status,
    organization_id: incident.organization_id ?? null,
    classification,
    primary_event_type: incident.primary_event_type,
    primary_event_id: incident.primary_event_id,
    first_observed_at: incident.first_observed_at,
    last_observed_at: incident.last_observed_at,
    centroid_lat: incident.centroid_lat,
    centroid_lng: incident.centroid_lng,
    event_count: incident.event_count,
    active_event_count: incident.active_event_count,
    source_types: incident.source_types,
    evidence_status: incident.evidence_status,
    attention_score: Number(incident.attention_score),
    verification_score: Number(incident.verification_score),
    action_score: Number(incident.action_score),
    attention_level: incident.attention_level,
    verification_level: incident.verification_level,
    action_level: incident.action_level,
    correlation_model_version: incident.correlation_model_version,
    resolved_at: incident.resolved_at,
    created_at: incident.created_at,
    updated_at: incident.updated_at,
  }
}
