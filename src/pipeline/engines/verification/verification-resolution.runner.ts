import {
  derivePlanResolution,
  evaluateNeedResolution,
} from '@/modules/verification/resolution/verification-resolution.engine'
import type {
  NeedResolutionSnapshot,
  ResolutionConflictInput,
  ValidatedEvidenceItem,
} from '@/modules/verification/resolution/verification-resolution.types'
import { getEvidenceObservation, listRequirementLinks } from '@/pipeline/stores/evidence-intake.store'
import {
  listMissionConflictFlags,
  listMissionValidations,
} from '@/pipeline/stores/evidence-validation.store'
import { getMissionById, listMissions } from '@/pipeline/stores/missions.store'
import {
  getVerificationPlanById,
  listVerificationNeedsForPlan,
} from '@/pipeline/stores/verification-plans.store'
import {
  claimVerificationResolutionCandidate,
  completeVerificationResolutionCandidate,
  deactivateActiveNeedResolution,
  enqueueReevaluationRequests,
  findResolutionEvalByContext,
  getActiveNeedResolution,
  insertNeedResolution,
  insertResolutionEvidenceLinks,
  recordResolutionEvaluationRun,
  recordResolutionEvent,
  updateNeedResolutionStatus,
  updatePlanResolutionStatus,
} from '@/pipeline/stores/verification-resolution.store'
import { enqueueVerificationResolutionJob } from '@/pipeline/stores/verification-resolution-jobs.store'
import { getIncidentById } from '@/pipeline/stores/incidents.store'

async function loadValidatedEvidenceForPlan(planId: string): Promise<ValidatedEvidenceItem[]> {
  const missions = await listMissions({ verification_plan_id: planId, limit: 200 })
  const items: ValidatedEvidenceItem[] = []

  for (const mission of missions) {
    const validations = await listMissionValidations(mission.id)
    for (const val of validations) {
      const submission = val.evidence_submissions as Record<string, unknown> | undefined
      if (!submission) continue
      const submissionId = String(submission.id)
      const observation = await getEvidenceObservation(submissionId)
      const links = await listRequirementLinks(submissionId)
      const coverage =
        links.find((l) => l.valid_coverage_status)?.valid_coverage_status ??
        (links[0]?.valid_coverage_status as string | null) ??
        null

      items.push({
        submission_id: submissionId,
        validation_id: String(val.id),
        evidence_type: String(submission.evidence_type),
        validation_status: String(val.status),
        evidence_strength: String(val.evidence_strength),
        overall_quality_score: Number(val.overall_quality_score),
        temporal_relevance_score: Number(val.temporal_relevance_score),
        spatial_relevance_score: Number(val.spatial_relevance_score),
        source_independence_score: Number(val.source_independence_score),
        submitted_by_id: String(submission.submitted_by_id),
        source_type: String(submission.source_type),
        source_device: (submission.source_device as string) ?? null,
        captured_at: (submission.captured_at as string) ?? null,
        verification_need_id: (mission.primary_verification_need_id as string) ?? null,
        requirement_ids: links.map((l) => String(l.requirement_id)),
        valid_coverage_status: coverage,
        limitations: (val.limitations as string[]) ?? [],
        observation: (observation?.fields as Record<string, unknown>) ?? null,
      })
    }
  }

  return items.sort((a, b) => a.submission_id.localeCompare(b.submission_id))
}

async function loadConflictsForPlan(
  planId: string,
  evidence: ValidatedEvidenceItem[],
): Promise<ResolutionConflictInput[]> {
  const missions = await listMissions({ verification_plan_id: planId, limit: 200 })
  const conflicts: ResolutionConflictInput[] = []
  const evidenceBySub = new Map(evidence.map((e) => [e.submission_id, e]))

  for (const mission of missions) {
    const flags = await listMissionConflictFlags(mission.id)
    for (const flag of flags) {
      const a = evidenceBySub.get(String(flag.submission_id_a))
      const b = evidenceBySub.get(String(flag.submission_id_b))
      conflicts.push({
        submission_id_a: String(flag.submission_id_a),
        submission_id_b: String(flag.submission_id_b),
        conflict_type: String(flag.conflict_type),
        conflict_field: (flag.conflict_field as string) ?? null,
        description: String(flag.description),
        captured_at_a: a?.captured_at ?? null,
        captured_at_b: b?.captured_at ?? null,
      })
    }
  }

  return conflicts.sort(
    (a, b) =>
      `${a.submission_id_a}:${a.submission_id_b}`.localeCompare(`${b.submission_id_a}:${b.submission_id_b}`),
  )
}

async function buildNeedSnapshot(
  need: Record<string, unknown>,
  plan: Record<string, unknown>,
  incident: Record<string, unknown> | null,
  evidence: ValidatedEvidenceItem[],
  conflicts: ResolutionConflictInput[],
): Promise<NeedResolutionSnapshot> {
  const missions = await listMissions({ verification_plan_id: String(plan.id), limit: 200 })
  const needId = String(need.id)
  const active = await getActiveNeedResolution(needId)

  const window = (need.recommended_window as { hours?: number }) ?? {}
  const incidentSnap = plan.incident_snapshot as Record<string, unknown>

  return {
    need_id: needId,
    need_type: String(need.need_type),
    need_question: String(need.need_question),
    need_priority: Number(need.priority),
    plan_id: String(plan.id),
    plan_status: String(plan.status),
    incident_id: String(plan.incident_id),
    incident_status: incident?.status ? String(incident.status) : String(incidentSnap.status ?? 'unknown'),
    incident_last_observed_at: incident?.last_observed_at
      ? String(incident.last_observed_at)
      : ((incidentSnap.last_observed_at as string) ?? null),
    recommended_window_hours: Number(window.hours ?? 48),
    validated_evidence: evidence,
    mission_outcomes: missions.map((m) => ({
      mission_id: m.id,
      status: m.status,
      mission_type: m.mission_type,
      verification_need_id: m.primary_verification_need_id,
      completed_at: m.completed_at,
    })),
    conflicts,
    previous_resolution_status: active
      ? (active.resolution_status as NeedResolutionSnapshot['previous_resolution_status'])
      : ((need.resolution_status as NeedResolutionSnapshot['previous_resolution_status']) ?? 'open'),
  }
}

export async function runNeedResolution(
  needId: string,
  options: { idempotencyKey?: string | null; force?: boolean } = {},
): Promise<{ skipped: boolean; resolution_id: string | null }> {
  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client')
  const admin = getSupabaseAdmin()
  const { data: needRow, error: needError } = await admin
    .from('verification_needs')
    .select('*')
    .eq('id', needId)
    .single()
  if (needError) throw new Error(needError.message)

  const plan = await getVerificationPlanById(String(needRow.plan_id))
  if (!plan) throw new Error('Plan no encontrado')

  const incident = await getIncidentById(plan.incident_id)
  const evidence = await loadValidatedEvidenceForPlan(plan.id)
  const conflicts = await loadConflictsForPlan(plan.id, evidence)
  const snapshot = await buildNeedSnapshot(needRow, plan, incident, evidence, conflicts)
  const result = evaluateNeedResolution(snapshot)

  if (!options.force) {
    const existingEval = await findResolutionEvalByContext(needId, result.context_signature)
    if (existingEval) {
      const active = await getActiveNeedResolution(needId)
      return { skipped: true, resolution_id: (active?.id as string) ?? null }
    }
  }

  const evalInsert = await recordResolutionEvaluationRun({
    needId,
    resolutionId: null,
    action: options.force ? 're_evaluate' : 'evaluate',
    contextSignature: result.context_signature,
    idempotencyKey: options.idempotencyKey,
    decision: result.resolution_status,
    warnings: result.warnings,
  })
  if (evalInsert.duplicate) {
    const active = await getActiveNeedResolution(needId)
    return { skipped: true, resolution_id: (active?.id as string) ?? null }
  }

  const previousId = await deactivateActiveNeedResolution(needId)
  const resolutionId = await insertNeedResolution({
    needId,
    planId: plan.id,
    incidentId: plan.incident_id,
    result,
    previousResolutionId: previousId,
  })
  await insertResolutionEvidenceLinks(resolutionId, result)
  await updateNeedResolutionStatus(needId, result.resolution_status)
  await recordResolutionEvent({
    resolutionId,
    needId,
    planId: plan.id,
    eventType: 'resolution_evaluated',
    payload: {
      status: result.resolution_status,
      previous_status: snapshot.previous_resolution_status,
      context_signature: result.context_signature,
    },
  })
  await enqueueReevaluationRequests({
    incidentId: plan.incident_id,
    planId: plan.id,
    needId,
    resolutionId,
    effects: result.downstream_effects,
    contextSignature: result.context_signature,
  })

  if (incident?.organization_id) {
    const { enqueueResponseAssessmentJob } = await import(
      '@/pipeline/stores/response-orchestration.store.js'
    )
    await enqueueResponseAssessmentJob({
      organizationId: String(incident.organization_id),
      incidentId: String(plan.incident_id),
      verificationResolutionId: resolutionId,
      dependencies: result.downstream_effects,
      idempotencyKey: `response-job:${resolutionId}:${result.context_signature}`,
    })
  }

  return { skipped: false, resolution_id: resolutionId }
}

export async function runPlanResolution(planId: string): Promise<void> {
  const plan = await getVerificationPlanById(planId)
  if (!plan) throw new Error('Plan no encontrado')

  const needs = await listVerificationNeedsForPlan(planId)
  const needResults: Array<{ need_id: string; need_type: string; status: import('@/modules/verification/resolution/verification-resolution.types').NeedResolutionStatus }> = []

  for (const need of needs) {
    const { resolution_id } = await runNeedResolution(String(need.id))
    const active = resolution_id ? await getActiveNeedResolution(String(need.id)) : null
    needResults.push({
      need_id: String(need.id),
      need_type: String(need.need_type),
      status: (active?.resolution_status ??
        (need.resolution_status as import('@/modules/verification/resolution/verification-resolution.types').NeedResolutionStatus)) ??
        'open',
    })
  }

  const summary = derivePlanResolution(planId, needResults)
  await updatePlanResolutionStatus(planId, summary.derived_status, summary.reasons.join('; '))
}

export async function processVerificationResolutionCandidate(): Promise<boolean> {
  const candidate = await claimVerificationResolutionCandidate()
  if (!candidate) return false

  try {
    const mission = await getMissionById(candidate.mission_id)
    if (!mission) {
      await completeVerificationResolutionCandidate(candidate.id)
      return true
    }
    await enqueueVerificationResolutionJob({
      planId: mission.verification_plan_id,
      missionId: mission.id,
      priority: 1,
    })
    await completeVerificationResolutionCandidate(candidate.id)
    return true
  } catch (err) {
    throw err
  }
}

export async function runVerificationResolutionJob(planId: string): Promise<void> {
  await runPlanResolution(planId)
}
