import { REEVALUATION_EFFECT_TYPES } from '@/modules/response-orchestration/config/fire-response-orchestration.config'
import type { ResponseOrchestrationInput } from '@/modules/response-orchestration/response-orchestration.types'
import { getIncidentById } from '@/pipeline/stores/incidents.store.js'
import { listIncidentActiveResolutions } from '@/pipeline/stores/verification-resolution.store.js'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client.js'

async function listReevaluationRequests(incidentId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('resolution_reevaluation_requests')
    .select('*')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

function buildReevaluationState(
  requests: Array<{ effect_type: string; status: string }>,
  resolutionSignature: string,
) {
  const pending = requests.filter((r) => r.status !== 'completed').map((r) => r.effect_type)
  const requested = new Set(requests.map((r) => r.effect_type))
  return {
    lifecycle_complete:
      !requested.has('lifecycle_reevaluation_requested') ||
      !pending.includes('lifecycle_reevaluation_requested'),
    findings_complete:
      !requested.has('finding_reevaluation_requested') ||
      !pending.includes('finding_reevaluation_requested'),
    priority_complete:
      !requested.has('priority_reevaluation_requested') ||
      !pending.includes('priority_reevaluation_requested'),
    incident_correlation_complete:
      !requested.has('incident_reevaluation_requested') ||
      !pending.includes('incident_reevaluation_requested'),
    verification_plan_complete:
      !requested.has('verification_replanning_requested') ||
      !pending.includes('verification_replanning_requested'),
    pending_effect_types: pending.filter((e) => REEVALUATION_EFFECT_TYPES.includes(e as never)),
    snapshot_versions: {
      lifecycle: 'db',
      findings: 'db',
      priority: 'db',
      incident: 'db',
      resolution: resolutionSignature,
    },
  }
}

export async function buildResponseOrchestrationInputForIncident(
  incidentId: string,
  organizationId: string,
): Promise<ResponseOrchestrationInput | { ownership_unresolved: true }> {
  const incident = await getIncidentById(incidentId)
  if (!incident) throw new Error('incident_not_found')
  if (!incident.organization_id) return { ownership_unresolved: true }
  if (String(incident.organization_id) !== organizationId) throw new Error('incident_org_mismatch')

  const resolutions = await listIncidentActiveResolutions(incidentId)
  const primary = resolutions[0]
  if (!primary) throw new Error('verification_resolution_missing')

  const reevalRequests = await listReevaluationRequests(incidentId)
  const resolutionSignature = String(primary.context_signature ?? primary.id)

  const supabase = getSupabaseAdmin()
  const { data: plan } = await supabase
    .from('verification_plans')
    .select('id, status')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const satisfied = resolutions.filter((r) => r.resolution_status === 'satisfied').length
  const inconclusive = resolutions.filter((r) =>
    ['inconclusive', 'insufficient_evidence'].includes(String(r.resolution_status)),
  ).length
  const conflicting = resolutions.filter((r) => r.resolution_status === 'conflicting_evidence').length

  const bundle = (primary.evidence_bundle as Record<string, unknown>) ?? {}
  const downstream = (primary.downstream_effects as string[]) ?? []

  return {
    organizationId,
    evaluated_at: new Date().toISOString(),
    incident: {
      incident_id: incidentId,
      incident_version: Number(incident.version ?? 1),
      status: String(incident.status),
      last_observed_at: (incident.last_observed_at as string) ?? null,
      organization_id: organizationId,
    },
    lifecycle: {
      lifecycle_state: String(incident.lifecycle_state ?? 'active'),
      validation_status: String(incident.validation_status ?? 'pending'),
      last_detected_at: (incident.last_observed_at as string) ?? null,
      inactive_since: null,
      persistence_hours: 0,
      version_signature: String(incident.lifecycle_model_version ?? '1'),
    },
    findings: [],
    priority: {
      attention_score: Number(incident.attention_score ?? 0),
      verification_score: Number(incident.verification_score ?? 0),
      action_score: Number(incident.action_score ?? 0),
      priority_band: String(incident.action_level ?? 'routine'),
      version_signature: 'db',
    },
    verificationPlan: plan
      ? {
          plan_id: String(plan.id),
          status: String(plan.status),
          open_needs_count: 0,
          version_signature: String(plan.id),
        }
      : undefined,
    verificationResolution: {
      resolution_id: String(primary.id),
      plan_id: String(primary.plan_id),
      plan_status: plan ? String(plan.status) : 'unknown',
      need_resolutions: resolutions.map((r) => ({
        need_id: String(r.verification_need_id),
        need_type: String(r.need_type ?? 'unknown'),
        status: String(r.resolution_status),
      })),
      satisfied_count: satisfied,
      inconclusive_count: inconclusive,
      conflicting_count: conflicting,
      remaining_uncertainties: (primary.remaining_uncertainties as string[]) ?? [],
      resolution_limitations: (primary.resolution_limitations as string[]) ?? [],
      downstream_effects: downstream,
      combined_strength: String(bundle.combined_strength ?? 'unknown'),
      has_material_conflict: conflicting > 0,
      non_vegetation_heat_indicated: false,
      recent_vegetation_activity_indicated: satisfied > 0,
      mission_completed_without_evidence: false,
      version_signature: resolutionSignature,
    },
    evidenceSummary: {
      validated_count: Number(bundle.validations_used?.length ?? 0),
      strong_count: 0,
      limited_count: 0,
      weak_count: 0,
      conflicting_count: conflicting,
      combined_strength: String(bundle.combined_strength ?? 'unknown'),
      independent_sources: 0,
    },
    territorialContext: {
      in_protected_area: false,
      population_exposure_level: 'unknown',
      land_cover_context: null,
      climate_stress_indicator: 'unknown',
    },
    reevaluationState: buildReevaluationState(reevalRequests, resolutionSignature),
  }
}
