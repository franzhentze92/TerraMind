import type { CompositeFinding } from '@/modules/findings/findings.types'
import { compositeFindingEngine } from '@/modules/findings/engine/composite-finding.engine'
import type { FireFindingEvaluationContext } from '@/modules/findings/services/fire-finding-context.loader'
import { genericLifecycleEngine } from '@/modules/lifecycle/engine/generic-lifecycle.engine'
import type { LifecycleEvaluationSnapshot } from '@/modules/lifecycle/lifecycle.types'
import { firePriorityEngine } from '@/modules/priorities/engine/fire-priority.engine'
import type { PriorityEvaluationResult } from '@/modules/priorities/priorities.types'
import { genericIncidentCorrelationEngine } from '@/modules/incidents/engine/generic-incident-correlation.engine'
import type { CorrelationEvaluationResult } from '@/modules/incidents/incidents.types'
import { genericVerificationPlanningEngine } from '@/modules/verification/engine/generic-verification-planning.engine'
import type { VerificationPlanResult } from '@/modules/verification/verification.types'
import { genericMissionsCoreEngine } from '@/modules/missions/engine/generic-missions.engine'
import type { MissionCreationResult, MissionPlanSnapshot, MissionStatus } from '@/modules/missions/missions.types'
import { evaluateWorkflowCommand } from '@/modules/missions/assignment/mission-workflow.engine'
import { SYNTHETIC_ASSIGNEES, ALL_MISSION_PERMISSIONS } from '@/modules/missions/config/fire-assignment.config'
import { evaluateEvidenceValidation } from '@/modules/evidence/validation/evidence-validation.engine'
import type { ValidationSnapshot } from '@/modules/evidence/validation/evidence-validation.types'
import {
  derivePlanResolution,
  evaluateNeedResolution,
} from '@/modules/verification/resolution/verification-resolution.engine'
import type {
  NeedResolutionResult,
  NeedResolutionSnapshot,
  ValidatedEvidenceItem,
} from '@/modules/verification/resolution/verification-resolution.types'
import {
  FIRE_E2E_DETECTED_AT,
  FIRE_E2E_FIRST_DETECTED,
  FIRE_E2E_GEOMETRY,
  FIRE_E2E_IDS,
  FIRE_E2E_NOW,
} from './fixtures/fire-e2e.constants'
import { buildFireE2E001FindingContext } from './fixtures/fire-e2e-contexts'

export type FireE2EScenarioId =
  | 'E2E-001'
  | 'E2E-002'
  | 'E2E-003'
  | 'E2E-004'
  | 'E2E-005'
  | 'E2E-006'

export interface FireE2EEvidenceVariant {
  photo?: Partial<ValidationSnapshot>
  observation?: Partial<ValidationSnapshot>
  observation_b?: Partial<ValidationSnapshot>
  mission_status?: string
  complete_mission?: boolean
  skip_evidence?: boolean
}

export interface FireE2EPipelineState {
  scenario_id: FireE2EScenarioId
  evaluated_at: string
  lifecycle: ReturnType<typeof genericLifecycleEngine.evaluate>
  findings: CompositeFinding[]
  finding_codes: string[]
  priority: PriorityEvaluationResult
  incident: CorrelationEvaluationResult
  verification_plan: VerificationPlanResult
  mission: MissionCreationResult
  mission_status: string
  assignment_history: string[]
  validated_evidence: ValidatedEvidenceItem[]
  need_resolution: NeedResolutionResult
  plan_resolution_status: string
  downstream_effects: string[]
  signatures: {
    lifecycle: string
    findings: string
    priority: string
    verification_plan: string
    mission: string | null
    resolution: string
  }
  counts: Record<string, number>
}

function lifecycleSnapshot(): LifecycleEvaluationSnapshot {
  return {
    entity_type: 'fire_event',
    entity_id: FIRE_E2E_IDS.event,
    lifecycle_state: 'detected',
    validation_status: 'no_validado',
    first_detected_at: FIRE_E2E_FIRST_DETECTED,
    last_detected_at: FIRE_E2E_DETECTED_AT,
    detection_count: 2,
    persistence_hours: 0.5,
    estimated_area_ha: 8,
    max_frp_mw: 18,
    inactive_since: null,
    monitoring_until: null,
    resolved_at: null,
    reactivated_at: null,
    last_confirmed_at: null,
    detections: [
      {
        id: 'det-1',
        acquired_at: FIRE_E2E_FIRST_DETECTED,
        latitude: FIRE_E2E_GEOMETRY.centroid_lat,
        longitude: FIRE_E2E_GEOMETRY.centroid_lng,
        frp_mw: 14,
        source_product: 'VIIRS_NOAA21_NRT',
      },
      {
        id: 'det-2',
        acquired_at: FIRE_E2E_DETECTED_AT,
        latitude: FIRE_E2E_GEOMETRY.centroid_lat + 0.001,
        longitude: FIRE_E2E_GEOMETRY.centroid_lng + 0.001,
        frp_mw: 18,
        source_product: 'VIIRS_NOAA21_NRT',
      },
    ],
  }
}

function buildMissionPlanFromVerification(plan: VerificationPlanResult): MissionPlanSnapshot {
  return {
    id: FIRE_E2E_IDS.plan,
    incident_id: FIRE_E2E_IDS.incident,
    status: plan.status,
    plan_priority: plan.plan_priority,
    mission_candidate_pending: plan.mission_candidate_pending,
    context_signature: plan.context_signature,
    recommended_window: plan.recommended_window,
    incident_snapshot: plan.incident_snapshot,
    needs: plan.needs.map((n, idx) => ({
      id: idx === 0 ? FIRE_E2E_IDS.need_visual : `${FIRE_E2E_IDS.need_visual.slice(0, -1)}${idx + 2}`,
      need_type: n.need_type,
      need_question: n.need_question,
      priority: n.priority,
      recommended_method_id: n.recommended_method?.method_id ?? null,
      recommended_window: { hours: n.recommended_window_hours },
      evidence_minimum: n.evidence_minimum,
      success_criteria: { text: n.success_criteria },
      inconclusive_criteria: { text: n.inconclusive_criteria },
      failure_criteria: { text: n.failure_criteria },
    })),
  }
}

function basePhotoValidationSnapshot(): ValidationSnapshot {
  return {
    submission_id: FIRE_E2E_IDS.photo_submission,
    submission_status: 'ready_for_validation',
    evidence_type: 'georeferenced_photo',
    source_type: 'mission_user',
    submitted_by_id: FIRE_E2E_IDS.assignee,
    submitted_by_type: 'user',
    submitted_at: FIRE_E2E_NOW,
    captured_at: FIRE_E2E_NOW,
    device_timestamp: FIRE_E2E_NOW,
    source_device: 'phone-e2e-1',
    source_application: 'terramind-field',
    location_geometry: FIRE_E2E_GEOMETRY.photo_point,
    device_location_geometry: FIRE_E2E_GEOMETRY.photo_point,
    location_accuracy_m: 12,
    location_outside_mission_area: false,
    location_discrepancy_m: 4,
    intake_status: 'ready_for_validation',
    mission: {
      id: FIRE_E2E_IDS.mission,
      earliest_start_at: FIRE_E2E_FIRST_DETECTED,
      due_at: '2026-07-10T18:00:00.000Z',
      expires_at: '2026-07-11T12:00:00.000Z',
      location_geometry: FIRE_E2E_GEOMETRY.mission_polygon as unknown as { type: string; coordinates: number[][][] },
      last_detected_at: FIRE_E2E_DETECTED_AT,
    },
    assets: [
      {
        id: 'asset-photo',
        mime_type: 'image/jpeg',
        size_bytes: 420_000,
        checksum_sha256: 'a'.repeat(64),
        upload_confirmed: true,
        mime_extension_mismatch: false,
        width: 1920,
        height: 1080,
        duration_seconds: null,
      },
    ],
    observation: null,
    requirement_links: [
      { requirement_id: 'req-photo', evidence_type: 'georeferenced_photo', match_type: 'matched', match_score: 95 },
    ],
    peer_submissions: [],
    is_exact_duplicate: false,
    is_superseded: false,
  }
}

function baseObservationValidationSnapshot(id: string, device: string, obs: Record<string, unknown>): ValidationSnapshot {
  return {
    submission_id: id,
    submission_status: 'ready_for_validation',
    evidence_type: 'structured_observation',
    source_type: 'mission_user',
    submitted_by_id: FIRE_E2E_IDS.assignee,
    submitted_by_type: 'user',
    submitted_at: FIRE_E2E_NOW,
    captured_at: FIRE_E2E_NOW,
    device_timestamp: FIRE_E2E_NOW,
    source_device: device,
    source_application: 'terramind-field',
    location_geometry: FIRE_E2E_GEOMETRY.photo_point,
    device_location_geometry: FIRE_E2E_GEOMETRY.photo_point,
    location_accuracy_m: 15,
    location_outside_mission_area: false,
    location_discrepancy_m: null,
    intake_status: 'ready_for_validation',
    mission: {
      id: FIRE_E2E_IDS.mission,
      earliest_start_at: FIRE_E2E_FIRST_DETECTED,
      due_at: '2026-07-10T18:00:00.000Z',
      expires_at: '2026-07-11T12:00:00.000Z',
      location_geometry: FIRE_E2E_GEOMETRY.mission_polygon as unknown as { type: string; coordinates: number[][][] },
      last_detected_at: FIRE_E2E_DETECTED_AT,
    },
    assets: [],
    observation: obs,
    requirement_links: [
      { requirement_id: 'req-obs', evidence_type: 'structured_observation', match_type: 'matched', match_score: 92 },
    ],
    peer_submissions: [],
    is_exact_duplicate: false,
    is_superseded: false,
  }
}

function validationToEvidenceItem(
  snapshot: ValidationSnapshot,
  validation: ReturnType<typeof evaluateEvidenceValidation>,
  needId: string,
): ValidatedEvidenceItem {
  return {
    submission_id: snapshot.submission_id,
    validation_id: `val-${snapshot.submission_id}`,
    evidence_type: snapshot.evidence_type,
    validation_status: validation.status,
    evidence_strength: validation.evidence_strength,
    overall_quality_score: validation.scores.overall_quality_score,
    temporal_relevance_score: validation.scores.temporal_relevance_score,
    spatial_relevance_score: validation.scores.spatial_relevance_score,
    source_independence_score: validation.scores.source_independence_score,
    submitted_by_id: snapshot.submitted_by_id,
    source_type: snapshot.source_type,
    source_device: snapshot.source_device,
    captured_at: snapshot.captured_at,
    verification_need_id: needId,
    requirement_ids: snapshot.requirement_links.map((l) => l.requirement_id),
    valid_coverage_status: validation.requirement_links[0]?.valid_coverage_status ?? 'valid_coverage',
    limitations: validation.limitations,
    observation: snapshot.observation,
  }
}

function buildResolutionSnapshot(input: {
  need_type: string
  validated_evidence: ValidatedEvidenceItem[]
  mission_status: string
  conflicts: NeedResolutionSnapshot['conflicts']
}): NeedResolutionSnapshot {
  return {
    need_id: FIRE_E2E_IDS.need_visual,
    need_type: input.need_type,
    need_question: '¿Existe evidencia visual compatible con actividad térmica reciente?',
    need_priority: 85,
    plan_id: FIRE_E2E_IDS.plan,
    plan_status: 'in_progress',
    incident_id: FIRE_E2E_IDS.incident,
    incident_status: 'open',
    incident_last_observed_at: FIRE_E2E_DETECTED_AT,
    recommended_window_hours: 48,
    validated_evidence: input.validated_evidence,
    mission_outcomes: [
      {
        mission_id: FIRE_E2E_IDS.mission,
        status: input.mission_status,
        mission_type: 'field_visual_inspection',
        verification_need_id: FIRE_E2E_IDS.need_visual,
        completed_at: input.mission_status === 'completed' ? FIRE_E2E_NOW : null,
      },
    ],
    conflicts: input.conflicts,
    previous_resolution_status: 'open',
  }
}

function evidenceVariantsForScenario(
  scenario: FireE2EScenarioId,
  overrides: FireE2EEvidenceVariant = {},
): {
  photo: ValidationSnapshot
  observation: ValidationSnapshot | null
  observation_b: ValidationSnapshot | null
  mission_status: string
  conflicts: NeedResolutionSnapshot['conflicts']
  need_type: string
} {
  const photo = { ...basePhotoValidationSnapshot(), ...overrides.photo }
  const observation = baseObservationValidationSnapshot(
    FIRE_E2E_IDS.observation_submission,
    'phone-e2e-1',
    {
      visible_smoke: 'yes',
      visible_flame: 'uncertain',
      burned_vegetation_indicators: 'yes',
      observation_distance_m: 150,
      visibility_conditions: 'good',
    },
  )
  const observation_b = baseObservationValidationSnapshot(
    FIRE_E2E_IDS.observation_b_submission,
    'phone-e2e-2',
    { visible_smoke: 'no', visible_flame: 'no', observation_distance_m: 160, visibility_conditions: 'good' },
  )

  switch (scenario) {
    case 'E2E-002':
      return {
        photo: {
          ...photo,
          location_geometry: { type: 'Point', coordinates: [-89.7, 17.3] },
          location_outside_mission_area: true,
          location_accuracy_m: 85,
          captured_at: null,
          ...overrides.photo,
        },
        observation: null,
        observation_b: null,
        mission_status: overrides.mission_status ?? 'completed',
        conflicts: [],
        need_type: 'obtain_visual_ground_evidence',
      }
    case 'E2E-003':
      return {
        photo: {
          ...photo,
          observation: {
            visible_smoke: 'uncertain',
            visible_flame: 'no',
            visibility_conditions: 'poor',
            observation_distance_m: 600,
          },
          ...overrides.photo,
        },
        observation: {
          ...observation,
          observation: {
            visible_smoke: 'uncertain',
            visible_flame: 'no',
            visibility_conditions: 'poor',
            observation_distance_m: 600,
          },
          ...overrides.observation,
        },
        observation_b: null,
        mission_status: overrides.mission_status ?? 'inconclusive',
        conflicts: [],
        need_type: 'obtain_visual_ground_evidence',
      }
    case 'E2E-004':
      return {
        photo,
        observation: { ...observation, ...overrides.observation },
        observation_b: { ...observation_b, ...overrides.observation_b },
        mission_status: overrides.mission_status ?? 'completed',
        conflicts: [
          {
            submission_id_a: FIRE_E2E_IDS.observation_submission,
            submission_id_b: FIRE_E2E_IDS.observation_b_submission,
            conflict_type: 'observation_contradiction',
            conflict_field: 'visible_smoke',
            description: 'Contradicción en visible_smoke',
            captured_at_a: FIRE_E2E_DETECTED_AT,
            captured_at_b: FIRE_E2E_DETECTED_AT,
          },
        ],
        need_type: 'obtain_visual_ground_evidence',
      }
    case 'E2E-005':
      return {
        photo: undefined as unknown as ValidationSnapshot,
        observation: {
          ...observation,
          observation: {
            possible_non_vegetation_source: 'industrial',
            heat_source_type: 'infrastructure',
            visible_smoke: 'no',
            visible_flame: 'no',
          },
          ...overrides.observation,
        },
        observation_b: null,
        mission_status: overrides.mission_status ?? 'completed',
        conflicts: [],
        need_type: 'differentiate_possible_non_fire_heat_source',
      }
    default:
      return {
        photo: undefined as unknown as ValidationSnapshot,
        observation: {
          ...observation,
          location_accuracy_m: 8,
          device_timestamp: FIRE_E2E_DETECTED_AT,
          observation: {
            visible_smoke: 'yes',
            visible_flame: 'uncertain',
            burned_vegetation_indicators: 'yes',
            observation_distance_m: 120,
            visibility_conditions: 'clara',
          },
          ...overrides.observation,
        },
        observation_b: null,
        mission_status: overrides.mission_status ?? (overrides.complete_mission === false ? 'in_progress' : 'completed'),
        conflicts: [],
        need_type: 'obtain_visual_ground_evidence',
      }
  }
}

export function runFullFireVerificationPipeline(
  scenario: FireE2EScenarioId = 'E2E-001',
  options: {
    findingContext?: FireFindingEvaluationContext
    evidence?: FireE2EEvidenceVariant
    shuffleEvidenceOrder?: boolean
  } = {},
): FireE2EPipelineState {
  const evaluatedAt = FIRE_E2E_NOW
  const findingContext = options.findingContext ?? buildFireE2E001FindingContext()

  const lifecycle = genericLifecycleEngine.evaluate({
    snapshot: lifecycleSnapshot(),
    evaluatedAt,
  })

  const findingsResult = compositeFindingEngine.evaluateFireEventContext(findingContext)
  const findings = findingsResult.findings

  const priority = firePriorityEngine.evaluateFireEventPriority({
    entity_type: 'fire_event',
    entity_id: FIRE_E2E_IDS.event,
    event: {
      id: FIRE_E2E_IDS.event,
      department_code: 'GT10',
      department_name: 'Petén',
      status: 'active',
      validation_status: 'no_validado',
      detection_count: 2,
      first_detected_at: FIRE_E2E_FIRST_DETECTED,
      last_detected_at: FIRE_E2E_DETECTED_AT,
      persistence_hours: 0.5,
      context_availability: {
        protected_area: 'partial',
        land_cover: 'complete',
        population: 'partial',
        climate: 'partial',
        biodiversity: 'partial',
      },
      context_version: findingContext.context_versions.composite,
      rule_set_version: findingContext.context_versions.rule_set,
    },
    findings,
    evaluated_at: evaluatedAt,
  })

  const incident = genericIncidentCorrelationEngine.evaluate({
    event: {
      event_type: 'fire_event',
      event_id: FIRE_E2E_IDS.event,
      lifecycle_state: lifecycle.new_state,
      validation_status: 'no_validado',
      status: 'active',
      department_id: 'dept-peten',
      department_name: 'Petén',
      centroid_lat: FIRE_E2E_GEOMETRY.centroid_lat,
      centroid_lng: FIRE_E2E_GEOMETRY.centroid_lng,
      first_detected_at: FIRE_E2E_FIRST_DETECTED,
      last_detected_at: FIRE_E2E_DETECTED_AT,
      detection_count: 2,
      persistence_hours: 0.5,
      estimated_area_ha: 8,
      source_products: ['VIIRS_NOAA21_NRT'],
      attention_score: priority.assessment.attention_score,
      verification_score: priority.assessment.verification_score,
      action_score: priority.assessment.action_score,
      attention_level: priority.assessment.attention_level,
      verification_level: priority.assessment.verification_level,
      action_level: priority.assessment.action_level,
      active_incident_id: null,
    },
    peerEvents: [],
    candidateIncidents: [],
    evaluatedAt,
  })

  const verificationPlan = genericVerificationPlanningEngine.evaluate({
    snapshot: {
      incident_id: FIRE_E2E_IDS.incident,
      incident_status: 'open',
      incident_type: 'fire_situation',
      domain: 'fire',
      evidence_status: 'thermal_only',
      verification_score: priority.assessment.verification_score,
      verification_level: priority.assessment.verification_level,
      attention_score: priority.assessment.attention_score,
      action_score: priority.assessment.action_score,
      action_level: priority.assessment.action_level,
      plan_limitations: [],
      priority_limitations: priority.assessment.priority_limitations,
      first_observed_at: FIRE_E2E_FIRST_DETECTED,
      last_observed_at: FIRE_E2E_DETECTED_AT,
      primary_event_id: FIRE_E2E_IDS.event,
      active_event_count: 1,
      event_count: 1,
      members: [
        {
          event_id: FIRE_E2E_IDS.event,
          lifecycle_state: lifecycle.new_state,
          last_detected_at: FIRE_E2E_DETECTED_AT,
          attention_score: priority.assessment.attention_score,
          verification_score: priority.assessment.verification_score,
          source_products: ['VIIRS_NOAA21_NRT'],
          context_availability: {
            land_cover: 'complete',
            population: 'partial',
            protected_area: 'partial',
        climate: 'partial',
        biodiversity: 'partial',
          },
          finding_limitations: [],
        },
      ],
      component_evidence_states: [],
      active_findings: findings.map((f) => ({
        finding_type: f.finding_type,
        severity_label: f.severity_label,
        confidence_level: f.confidence.level,
        status: f.status,
        limitations: f.limitations,
      })),
    },
    evaluatedAt,
  })

  const missionPlan = buildMissionPlanFromVerification(verificationPlan)
  const mission = genericMissionsCoreEngine.evaluate({ plan: missionPlan, evaluatedAt })

  const actor = {
    actor_type: 'user' as const,
    actor_id: FIRE_E2E_IDS.assignee,
    permissions: ALL_MISSION_PERMISSIONS,
  }
  const assignmentHistory: string[] = []
  let missionStatus: MissionStatus = (mission.status ?? 'ready') as MissionStatus
  const missionExpiresAt = mission.expires_at ?? '2026-07-11T12:00:00.000Z'
  const missionDueAt = mission.due_at ?? '2026-07-11T12:00:00.000Z'
  const missionType = mission.mission_type ?? 'field_visual_inspection'

  const methodCode =
    mission.eligibility.recommended_method_code ?? missionPlan.needs[0]?.recommended_method_id ?? 'field_visual_inspection'

  const assignee =
    mission.mission_type === 'remote_analytical_review'
      ? SYNTHETIC_ASSIGNEES.remote_analyst
      : SYNTHETIC_ASSIGNEES.field_inspector

  const assign = evaluateWorkflowCommand({
    command: {
      action: 'assign',
      mission_id: FIRE_E2E_IDS.mission,
      assignee_type: 'user',
      assignee_id: assignee.id,
      actor,
    },
    mission: {
      id: FIRE_E2E_IDS.mission,
      status: missionStatus,
      mission_type: missionType,
      recommended_method_code: methodCode,
      expires_at: missionExpiresAt,
      due_at: missionDueAt,
      required_tasks_pending: mission.tasks.length,
    },
    assignment: null,
    assignee,
    assignee_active_count: 0,
    now_iso: evaluatedAt,
  })
  if (assign.ok && assign.next_mission_status) {
    missionStatus = assign.next_mission_status
    assignmentHistory.push('assign')
  }

  const accept = evaluateWorkflowCommand({
    command: { action: 'accept', mission_id: FIRE_E2E_IDS.mission, actor },
    mission: {
      id: FIRE_E2E_IDS.mission,
      status: missionStatus,
      mission_type: missionType,
      recommended_method_code: methodCode,
      expires_at: missionExpiresAt,
      due_at: missionDueAt,
      required_tasks_pending: mission.tasks.length,
    },
    assignment: {
      id: FIRE_E2E_IDS.assignment,
      status: 'assigned',
      assignee_id: assignee.id,
      assignee_type: 'user',
      idempotency_key: null,
    },
    assignee,
    now_iso: evaluatedAt,
  })
  if (accept.ok && accept.next_mission_status) {
    missionStatus = accept.next_mission_status
    assignmentHistory.push('accept')
  }

  const start = evaluateWorkflowCommand({
    command: { action: 'start', mission_id: FIRE_E2E_IDS.mission, actor },
    mission: {
      id: FIRE_E2E_IDS.mission,
      status: missionStatus,
      mission_type: missionType,
      recommended_method_code: methodCode,
      expires_at: missionExpiresAt,
      due_at: missionDueAt,
      required_tasks_pending: mission.tasks.length,
    },
    assignment: {
      id: FIRE_E2E_IDS.assignment,
      status: 'accepted',
      assignee_id: assignee.id,
      assignee_type: 'user',
      idempotency_key: null,
    },
    assignee,
    now_iso: evaluatedAt,
  })
  if (start.ok && start.next_mission_status) {
    missionStatus = start.next_mission_status
    assignmentHistory.push('start')
  }

  const evidenceCfg = evidenceVariantsForScenario(scenario, options.evidence)
  if (evidenceCfg.mission_status) {
    missionStatus = evidenceCfg.mission_status as MissionStatus
  } else if (evidenceCfg.mission_status !== 'inconclusive' && scenario !== 'E2E-003') {
    if (options.evidence?.complete_mission !== false) {
      missionStatus = 'completed'
    }
  }

  const validationSnapshots: ValidationSnapshot[] = []
  if (!options.evidence?.skip_evidence) {
    if (evidenceCfg.photo) validationSnapshots.push(evidenceCfg.photo)
    if (evidenceCfg.observation) validationSnapshots.push(evidenceCfg.observation)
    if (evidenceCfg.observation_b) validationSnapshots.push(evidenceCfg.observation_b)
  }

  const orderedSnapshots = options.shuffleEvidenceOrder
    ? [...validationSnapshots].reverse()
    : validationSnapshots

  for (const snap of orderedSnapshots) {
    snap.peer_submissions = orderedSnapshots
      .filter((p) => p.submission_id !== snap.submission_id)
      .map((p) => ({
        submission_id: p.submission_id,
        submitted_by_id: p.submitted_by_id,
        source_type: p.source_type,
        source_device: p.source_device,
        captured_at: p.captured_at,
        observation: p.observation,
        validation_status: null,
      }))
  }

  const validated_evidence = orderedSnapshots.map((snap) => {
    const validation = evaluateEvidenceValidation(snap)
    return validationToEvidenceItem(
      snap,
      validation,
      evidenceCfg.need_type === 'differentiate_possible_non_fire_heat_source'
        ? FIRE_E2E_IDS.need_non_fire
        : FIRE_E2E_IDS.need_visual,
    )
  })

  const resolutionNeedId =
    evidenceCfg.need_type === 'differentiate_possible_non_fire_heat_source'
      ? FIRE_E2E_IDS.need_non_fire
      : FIRE_E2E_IDS.need_visual

  const need_resolution = evaluateNeedResolution(
    {
      ...buildResolutionSnapshot({
        need_type: evidenceCfg.need_type,
        validated_evidence,
        mission_status: missionStatus,
        conflicts: evidenceCfg.conflicts,
      }),
      need_id: resolutionNeedId,
    },
  )

  const planSummary = derivePlanResolution(FIRE_E2E_IDS.plan, [
    {
      need_id: resolutionNeedId,
      need_type: evidenceCfg.need_type,
      status: need_resolution.resolution_status,
    },
  ])

  return {
    scenario_id: scenario,
    evaluated_at: evaluatedAt,
    lifecycle,
    findings,
    finding_codes: findings.map((f) => f.triggered_rules[0]),
    priority,
    incident,
    verification_plan: verificationPlan,
    mission,
    mission_status: missionStatus,
    assignment_history: assignmentHistory,
    validated_evidence,
    need_resolution,
    plan_resolution_status: planSummary.derived_status,
    downstream_effects: need_resolution.downstream_effects,
    signatures: {
      lifecycle: lifecycle.context_signature,
      findings: findingsResult.context_version,
      priority: priority.assessment.context_version,
      verification_plan: verificationPlan.context_signature,
      mission: mission.context_signature ?? null,
      resolution: need_resolution.context_signature,
    },
    counts: {
      findings: findings.length,
      needs: verificationPlan.needs.length,
      tasks: mission.tasks.length,
      evidence_requirements: mission.evidence_requirements.length,
      validated_evidence: validated_evidence.length,
      downstream_effects: need_resolution.downstream_effects.length,
      assignment_steps: assignmentHistory.length,
    },
  }
}

export function assertNoPipelineDuplicates(first: FireE2EPipelineState, second: FireE2EPipelineState): void {
  if (first.signatures.lifecycle !== second.signatures.lifecycle) {
    throw new Error('lifecycle signature drift on reproceso')
  }
  if (first.signatures.resolution !== second.signatures.resolution) {
    throw new Error('resolution signature drift on reproceso')
  }
  if (first.counts.findings !== second.counts.findings) {
    throw new Error('findings count drift on reproceso')
  }
  if (first.counts.downstream_effects !== second.counts.downstream_effects) {
    throw new Error('downstream effects count drift on reproceso')
  }
}
