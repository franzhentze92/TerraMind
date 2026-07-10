import { evaluateEvidenceValidation } from '@/modules/evidence/validation/evidence-validation.engine'
import type { ValidationSnapshot } from '@/modules/evidence/validation/evidence-validation.types'
import {
  getEvidenceObservation,
  getEvidenceSubmissionById,
  listEvidenceAssets,
  listEvidenceSubmissionsByMission,
  listRequirementLinks,
} from '@/pipeline/stores/evidence-intake.store'
import {
  findValidationEvalByContext,
  getActiveValidation,
  insertValidation,
  insertValidationChecks,
  recordValidationEvaluationRun,
  recordValidationEvent,
  deactivateActiveValidation,
  supersedeActiveValidation,
  updateRequirementLinkCoverage,
  upsertConflictFlags,
  enqueueVerificationResolutionCandidate,
} from '@/pipeline/stores/evidence-validation.store'
import { getMissionById, listMissionEvidenceRequirements } from '@/pipeline/stores/missions.store'

async function buildValidationSnapshot(submissionId: string): Promise<ValidationSnapshot> {
  const submission = await getEvidenceSubmissionById(submissionId)
  if (!submission) throw new Error('Submission no encontrada')

  const mission = await getMissionById(String(submission.mission_id))
  if (!mission) throw new Error('Misión no encontrada')

  const [assets, observation, links, peers, requirements] = await Promise.all([
    listEvidenceAssets(submissionId),
    getEvidenceObservation(submissionId),
    listRequirementLinks(submissionId),
    listEvidenceSubmissionsByMission(String(submission.mission_id)),
    listMissionEvidenceRequirements(String(submission.mission_id)),
  ])

  const reqTypeMap = new Map(
    (requirements as Array<Record<string, unknown>>).map((r) => [String(r.id), String(r.evidence_type)]),
  )

  const peer_submissions = await Promise.all(
    peers
      .filter((p) => String(p.id) !== submissionId)
      .map(async (p) => {
        const obs = await getEvidenceObservation(String(p.id))
        const val = await getActiveValidation(String(p.id))
        return {
          submission_id: String(p.id),
          submitted_by_id: String(p.submitted_by_id),
          source_type: String(p.source_type),
          source_device: p.source_device as string | null,
          captured_at: p.captured_at as string | null,
          observation: (obs?.fields as Record<string, unknown>) ?? null,
          validation_status: val?.status as ValidationSnapshot['peer_submissions'][0]['validation_status'],
        }
      }),
  )

  const sourceSnapshot = mission.source_snapshot as Record<string, unknown> | null
  const incidentSnap = sourceSnapshot?.incident_snapshot as Record<string, unknown> | undefined

  return {
    submission_id: submissionId,
    submission_status: String(submission.status),
    evidence_type: String(submission.evidence_type),
    source_type: String(submission.source_type),
    submitted_by_id: String(submission.submitted_by_id),
    submitted_by_type: String(submission.submitted_by_type),
    submitted_at: String(submission.submitted_at),
    captured_at: submission.captured_at as string | null,
    device_timestamp: submission.device_timestamp as string | null,
    source_device: submission.source_device as string | null,
    source_application: submission.source_application as string | null,
    location_geometry: submission.location_geometry as ValidationSnapshot['location_geometry'],
    device_location_geometry: submission.device_location_geometry as ValidationSnapshot['device_location_geometry'],
    location_accuracy_m: submission.location_accuracy_m as number | null,
    location_outside_mission_area: Boolean(submission.location_outside_mission_area),
    location_discrepancy_m: submission.location_discrepancy_m as number | null,
    intake_status: String(submission.status),
    mission: {
      id: String(mission.id),
      earliest_start_at: String(mission.earliest_start_at),
      due_at: String(mission.due_at),
      expires_at: String(mission.expires_at),
      location_geometry: mission.location_geometry as ValidationSnapshot['mission']['location_geometry'],
      last_detected_at: (incidentSnap?.last_observed_at as string) ?? null,
    },
    assets: assets.map((a) => ({
      id: String(a.id),
      mime_type: String(a.mime_type),
      size_bytes: Number(a.size_bytes),
      checksum_sha256: a.checksum_sha256 as string | null,
      upload_confirmed: Boolean(a.upload_confirmed),
      mime_extension_mismatch: Boolean(a.mime_extension_mismatch),
      width: a.width as number | null,
      height: a.height as number | null,
      duration_seconds: a.duration_seconds as number | null,
    })),
    observation: (observation?.fields as Record<string, unknown>) ?? null,
    requirement_links: links.map((l) => ({
      requirement_id: String(l.requirement_id),
      evidence_type: reqTypeMap.get(String(l.requirement_id)) ?? String(submission.evidence_type),
      match_type: String(l.match_type),
      match_score: Number(l.match_score),
    })),
    peer_submissions,
    is_exact_duplicate: submission.status === 'duplicate',
    is_superseded: Boolean(submission.superseded_by_submission_id),
  }
}

export async function runEvidenceValidation(
  submissionId: string,
  options: { idempotencyKey?: string | null; force?: boolean } = {},
): Promise<{ skipped: boolean; validation_id: string | null }> {
  const snapshot = await buildValidationSnapshot(submissionId)
  const result = evaluateEvidenceValidation(snapshot)

  if (!options.force) {
    const existingEval = await findValidationEvalByContext(submissionId, result.context_signature)
    if (existingEval) {
      const active = await getActiveValidation(submissionId)
      return { skipped: true, validation_id: (active?.id as string) ?? null }
    }
  }

  const evalInsert = await recordValidationEvaluationRun({
    submissionId,
    validationId: null,
    action: options.force ? 'revalidate' : 'validate',
    contextSignature: result.context_signature,
    idempotencyKey: options.idempotencyKey,
    decision: result.status,
    warnings: result.warnings,
  })
  if (evalInsert.duplicate) {
    const active = await getActiveValidation(submissionId)
    return { skipped: true, validation_id: (active?.id as string) ?? null }
  }

  const previousActiveId = await deactivateActiveValidation(submissionId)

  const validationId = await insertValidation(submissionId, result)
  if (previousActiveId) {
    await supersedeActiveValidation({ submissionId, newValidationId: validationId })
  }
  await insertValidationChecks(validationId, result.checks)
  await updateRequirementLinkCoverage(submissionId, result.requirement_links)
  await upsertConflictFlags(snapshot.mission.id, result.conflict_flags)
  await recordValidationEvent({
    validationId,
    submissionId,
    eventType: 'validation_completed',
    payload: {
      status: result.status,
      evidence_strength: result.evidence_strength,
      overall_quality_score: result.scores.overall_quality_score,
    },
  })

  if (['accepted', 'accepted_with_limitations', 'inconclusive'].includes(result.status)) {
    await enqueueVerificationResolutionCandidate(
      snapshot.mission.id,
      `validation_${result.status}_submission_${submissionId}`,
    )
  }

  return { skipped: false, validation_id: validationId }
}
