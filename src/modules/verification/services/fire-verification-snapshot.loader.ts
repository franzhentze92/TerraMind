import type { IncidentVerificationSnapshot } from '@/modules/verification/verification.types'
import { getIncidentById } from '@/pipeline/stores/incidents.store'
import { loadIncidentMemberSnapshots } from '@/modules/incidents/services/fire-incident-snapshot.loader'
import { getActivePriorityAssessment } from '@/pipeline/stores/priority-assessments.store'
import { listActiveFindingsForEntity } from '@/pipeline/stores/composite-findings.store'
import { FIRE_PRIORITY_MODEL_VERSION } from '@/modules/priorities/config/fire-priority.config'
import { FIRE_PRIORITY_FINDINGS_RULE_SET } from '@/modules/priorities/config/fire-priority.config'
import { loadFireFindingEvaluationContext } from '@/modules/findings/services/fire-finding-context.loader'

export async function loadIncidentVerificationSnapshot(
  incidentId: string,
): Promise<IncidentVerificationSnapshot | null> {
  const incident = await getIncidentById(incidentId)
  if (!incident) return null

  const members = await loadIncidentMemberSnapshots(incidentId)
  const componentStates: IncidentVerificationSnapshot['component_evidence_states'] = []
  const activeFindings: IncidentVerificationSnapshot['active_findings'] = []

  const memberContexts = new Map<string, Record<string, string>>()

  for (const member of members) {
    const priorityRow = await getActivePriorityAssessment(
      'fire_event',
      member.event_id,
      FIRE_PRIORITY_MODEL_VERSION,
    )
    const states = (
      priorityRow?.score_explanation as { component_evidence_states?: Array<{
        component: string
        state: string
        note: string
      }> } | undefined
    )?.component_evidence_states
    if (states) {
      for (const s of states) {
        if (!componentStates.some((c) => c.component === s.component && c.state === s.state)) {
          componentStates.push(s)
        }
      }
    }

    const findings = await listActiveFindingsForEntity(
      'fire_event',
      member.event_id,
      FIRE_PRIORITY_FINDINGS_RULE_SET,
    )
    for (const f of findings) {
      activeFindings.push({
        finding_type: String(f.finding_type),
        limitations: (f.limitations as string[] | null) ?? [],
        confidence_level: String((f.confidence as { level?: string })?.level ?? 'moderate'),
      })
    }

    const ctx = await loadFireFindingEvaluationContext(member.event_id)
    if (ctx) {
      memberContexts.set(member.event_id, {
        protected_area: ctx.availability.protected_area,
        land_cover: ctx.availability.land_cover,
        population: ctx.availability.population,
        climate: ctx.availability.climate,
        biodiversity: ctx.availability.biodiversity,
      })
    }
  }

  return {
    incident_id: incident.id,
    incident_status: incident.status,
    incident_type: incident.incident_type,
    domain: incident.domain,
    evidence_status: incident.evidence_status,
    verification_score: Number(incident.verification_score),
    verification_level: incident.verification_level,
    attention_score: Number(incident.attention_score),
    action_score: Number(incident.action_score),
    action_level: incident.action_level,
    plan_limitations: [],
    priority_limitations: incident.priority_limitations ?? [],
    first_observed_at: incident.first_observed_at,
    last_observed_at: incident.last_observed_at,
    primary_event_id: incident.primary_event_id,
    active_event_count: incident.active_event_count,
    event_count: incident.event_count,
    members: members.map((m) => ({
      event_id: m.event_id,
      lifecycle_state: m.lifecycle_state,
      last_detected_at: m.last_detected_at,
      attention_score: m.attention_score,
      verification_score: m.verification_score,
      source_products: m.source_products,
      context_availability: memberContexts.get(m.event_id) ?? {},
      finding_limitations: [],
    })),
    component_evidence_states: componentStates,
    active_findings: activeFindings,
  }
}

export async function listIncidentCandidatesForVerification(
  limit = 10000,
): Promise<Array<{ id: string }>> {
  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client')
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('incidents')
    .select('id')
    .in('status', ['open', 'monitoring', 'resolved'])
    .order('last_observed_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({ id: String(r.id) }))
}
