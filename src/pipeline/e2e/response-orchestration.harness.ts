import type { FireE2EPipelineState } from '@/pipeline/e2e/fire-intelligence-pipeline.harness'
import type { ResponseOrchestrationInput } from '@/modules/response-orchestration/response-orchestration.types'
import { FIRE_E2E_IDS, FIRE_E2E_NOW } from '@/pipeline/e2e/fixtures/fire-e2e.constants'

function completeReevaluationState(downstream: string[], resolutionSignature: string) {
  const requested = new Set(downstream)
  return {
    lifecycle_complete: requested.has('lifecycle_reevaluation_requested') || downstream.length === 0,
    findings_complete: requested.has('finding_reevaluation_requested') || downstream.length === 0,
    priority_complete: requested.has('priority_reevaluation_requested') || downstream.length === 0,
    incident_correlation_complete: requested.has('incident_reevaluation_requested') || downstream.length === 0,
    verification_plan_complete: true,
    pending_effect_types: [] as string[],
    snapshot_versions: {
      lifecycle: 'lc-v1',
      findings: 'fd-v1',
      priority: 'pr-v1',
      incident: '1',
      resolution: resolutionSignature,
    },
  }
}

export function buildResponseInputFromE2EState(
  state: FireE2EPipelineState,
  overrides?: Partial<ResponseOrchestrationInput>,
): ResponseOrchestrationInput {
  const nr = state.need_resolution
  const nonVegetation = state.scenario_id === 'E2E-005'
  const missionNoEvidence =
    state.validated_evidence.length === 0 && state.mission_status === 'completed'

  const base: ResponseOrchestrationInput = {
    organizationId: 'org-e2e',
    evaluated_at: state.evaluated_at,
    incident: {
      incident_id: state.incident.target_incident_id ?? FIRE_E2E_IDS.incident,
      incident_version: 1,
      status: 'open',
      last_observed_at: FIRE_E2E_NOW,
      organization_id: 'org-e2e',
    },
    lifecycle: {
      lifecycle_state: state.lifecycle.new_state,
      validation_status: 'no_validado',
      last_detected_at: FIRE_E2E_NOW,
      inactive_since: null,
      persistence_hours: 0.5,
      version_signature: state.signatures.lifecycle,
    },
    findings: state.findings.map((f, i) => ({
      finding_id: f.id ?? `f-${i}`,
      finding_code: f.triggered_rules[0] ?? f.finding_type,
      finding_type: f.finding_type,
      summary: f.summary,
      version_signature: state.signatures.findings,
    })),
    priority: {
      attention_score: state.priority.assessment.attention_score,
      verification_score: state.priority.assessment.verification_score,
      action_score: state.priority.assessment.action_score,
      priority_band: state.priority.assessment.attention_level,
      version_signature: state.signatures.priority,
    },
    verificationPlan: {
      plan_id: FIRE_E2E_IDS.plan,
      status: state.plan_resolution_status,
      open_needs_count: state.verification_plan.needs.length,
      version_signature: state.signatures.verification_plan,
    },
    verificationResolution: {
      resolution_id: 'res-e2e',
      plan_id: FIRE_E2E_IDS.plan,
      plan_status: state.plan_resolution_status,
      need_resolutions: state.verification_plan.needs.map((n, i) => ({
        need_id: `need-${i}`,
        need_type: n.need_type,
        status: nr.resolution_status,
      })),
      satisfied_count: nr.resolution_status === 'satisfied' ? 1 : 0,
      inconclusive_count: ['inconclusive', 'insufficient_evidence'].includes(nr.resolution_status) ? 1 : 0,
      conflicting_count: nr.resolution_status === 'conflicting_evidence' ? 1 : 0,
      remaining_uncertainties: nr.remaining_uncertainties,
      resolution_limitations: nr.resolution_limitations,
      downstream_effects: state.downstream_effects,
      combined_strength: nr.resolution_strength,
      has_material_conflict: nr.resolution_status === 'conflicting_evidence',
      non_vegetation_heat_indicated: nonVegetation,
      recent_vegetation_activity_indicated:
        nr.resolution_status === 'satisfied' && !nonVegetation && state.validated_evidence.length > 0,
      mission_completed_without_evidence: missionNoEvidence,
      version_signature: state.signatures.resolution,
    },
    evidenceSummary: {
      validated_count: state.validated_evidence.length,
      strong_count: state.validated_evidence.filter((e) => e.evidence_strength === 'strong').length,
      limited_count: state.validated_evidence.filter((e) => e.validation_status === 'accepted_with_limitations')
        .length,
      weak_count: state.validated_evidence.filter((e) => e.evidence_strength === 'weak').length,
      conflicting_count: nr.resolution_status === 'conflicting_evidence' ? 1 : 0,
      combined_strength: nr.resolution_strength,
      independent_sources: new Set(state.validated_evidence.map((e) => e.submitted_by_id)).size,
    },
    missionSummary: {
      mission_id: state.mission.mission_id,
      status: state.mission_status,
      completed_at: state.mission_status === 'completed' ? FIRE_E2E_NOW : null,
      evidence_submitted: state.validated_evidence.length > 0,
    },
    territorialContext: {
      in_protected_area: false,
      population_exposure_level: 'low',
      land_cover_context: 'vegetation',
      climate_stress_indicator: 'moderate',
    },
    reevaluationState: completeReevaluationState(state.downstream_effects, state.signatures.resolution),
  }

  return { ...base, ...overrides }
}
