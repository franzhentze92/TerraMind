import type { RequestAuthContext } from '@/core/auth/permissions'
import {
  evaluateConfirmUpload,
  evaluateCreateSubmission,
  evaluateWithdrawSubmission,
} from '@/modules/evidence/engine/evidence-intake.engine'
import { computeEvidenceCoverage } from '@/modules/evidence/engine/evidence-requirement-matching.engine'
import { assertSafeEvidenceCopy } from '@/modules/evidence/evidence-intake-copy-guard'
import type {
  EvidenceAssetInput,
  EvidenceCoverageSnapshot,
  EvidenceSubmissionInput,
  StructuredObservationInput,
} from '@/modules/evidence/evidence-intake.types'
import {
  ALL_EVIDENCE_PERMISSIONS,
  FIRE_STRUCTURED_OBSERVATION_SCHEMA,
  UPLOAD_URL_TTL_SECONDS,
} from '@/modules/evidence/config/fire-evidence-intake.config'
import {
  buildStoragePath,
  createSignedUploadUrl,
  findAssetByIdempotency,
  findSubmissionByIdempotency,
  getEvidenceObservation,
  getEvidenceSubmissionById,
  insertEvidenceAsset,
  insertEvidenceSubmission,
  listEvidenceAssets,
  listEvidenceSubmissionsByIncident,
  listEvidenceSubmissionsByMission,
  listEvidenceSubmissionsByTask,
  listRequirementLinks,
  listIntakeEvents,
  recordIntakeEvaluationRun,
  recordIntakeEvent,
  supersedeSubmission,
  updateSubmissionStatus,
  upsertEvidenceObservation,
} from '@/pipeline/stores/evidence-intake.store'
import { enqueueEvidenceProcessingJob } from '@/pipeline/stores/evidence-processing-jobs.store'
import { runEvidenceProcessing } from '@/pipeline/engines/evidence/evidence-intake-processing.runner'
import {
  getMissionById,
  listMissionEvidenceRequirements,
} from '@/pipeline/stores/missions.store'

function defaultPermissions() {
  return ALL_EVIDENCE_PERMISSIONS
}

function mapRequirements(rows: Array<Record<string, unknown>>) {
  return rows.map((r) => ({
    id: String(r.id),
    evidence_type: String(r.evidence_type),
    required: Boolean(r.required),
    minimum_count: Number(r.minimum_count),
    required_metadata: (r.required_metadata as string[]) ?? [],
    verification_need_id: r.verification_need_id ? String(r.verification_need_id) : null,
  }))
}

function resolveActorId(auth: RequestAuthContext | null | undefined, actorId?: string | null): string {
  const resolved = auth?.userId ?? actorId
  if (!resolved) throw new Error('actor_authentication_required')
  return resolved
}

function actorPermissions(auth: RequestAuthContext | null | undefined) {
  if (!auth) return defaultPermissions()
  return ALL_EVIDENCE_PERMISSIONS.filter((p) => auth.permissions.includes(p as never))
}

export async function createEvidenceSubmission(
  missionId: string,
  input: Omit<EvidenceSubmissionInput, 'mission_id' | 'actor'> & {
    actor_id?: string | null
    actor_permissions?: EvidenceSubmissionInput['actor']['permissions']
    supersedes_submission_id?: string | null
    supersede_reason?: string | null
  },
  auth?: RequestAuthContext | null,
) {
  const mission = await getMissionById(missionId)
  if (!mission) throw new Error('Misión no encontrada')

  const command: EvidenceSubmissionInput = {
    ...input,
    mission_id: missionId,
    actor: {
      actor_type: 'user',
      actor_id: resolveActorId(auth, input.actor_id),
      permissions: input.actor_permissions ?? actorPermissions(auth),
    },
  }

  if (command.idempotency_key) {
    const existing = await findSubmissionByIdempotency(missionId, command.idempotency_key)
    if (existing) {
      return { ok: true, submission: existing, idempotent_replay: true }
    }
  }

  const evaluation = evaluateCreateSubmission({
    command,
    mission_status: String(mission.status),
    mission_cancelled: mission.status === 'cancelled',
  })

  if (!evaluation.ok) {
    throw new Error(evaluation.reasons.join('; '))
  }

  const submission = await insertEvidenceSubmission({
    command,
    incident_id: String(mission.incident_id),
    verification_plan_id: String(mission.verification_plan_id),
    context_signature: String(mission.context_signature),
  })

  const submissionId = String(submission.id)
  await recordIntakeEvent({
    submissionId,
    eventType: 'submission_created',
    actorId: command.actor.actor_id,
    payload: { evidence_type: command.evidence_type },
  })

  if (input.supersedes_submission_id) {
    await supersedeSubmission({
      oldSubmissionId: input.supersedes_submission_id,
      newSubmissionId: submissionId,
      reason: input.supersede_reason ?? 'Reemplazo de evidencia',
    })
    await recordIntakeEvent({
      submissionId,
      eventType: 'supersedes_previous',
      actorId: command.actor.actor_id,
      payload: { supersedes: input.supersedes_submission_id },
    })
  }

  await recordIntakeEvaluationRun({
    submissionId,
    action: 'create_submission',
    idempotencyKey: command.idempotency_key,
    decision: 'allowed',
    warnings: evaluation.warnings,
  })

  return { ok: true, submission, idempotent_replay: false }
}

export async function issueEvidenceUploadUrl(
  submissionId: string,
  input: { original_filename: string; mime_type: string; actor_id?: string | null },
) {
  const submission = await getEvidenceSubmissionById(submissionId)
  if (!submission) throw new Error('Submission no encontrada')
  if (submission.status === 'withdrawn') throw new Error('Submission retirada')

  const assets = await listEvidenceAssets(submissionId)
  const evaluation = evaluateConfirmUpload({
    evidence_type: String(submission.evidence_type),
    asset_count: assets.length,
    mime_type: input.mime_type,
    permissions: defaultPermissions(),
  })
  if (!evaluation.ok) throw new Error(evaluation.reasons.join('; '))

  const storagePath = buildStoragePath(
    String(submission.mission_id),
    submissionId,
    input.original_filename,
  )
  const signed = await createSignedUploadUrl(storagePath, UPLOAD_URL_TTL_SECONDS)

  await recordIntakeEvent({
    submissionId,
    eventType: 'upload_url_issued',
    actorId: input.actor_id ?? null,
    payload: { storage_path: storagePath, mime_type: input.mime_type },
  })

  return {
    upload_url: signed.signedUrl,
    token: signed.token,
    storage_path: storagePath,
    expires_in: UPLOAD_URL_TTL_SECONDS,
  }
}

export async function confirmEvidenceUpload(
  submissionId: string,
  asset: EvidenceAssetInput & { storage_path: string; actor_id?: string | null },
) {
  const submission = await getEvidenceSubmissionById(submissionId)
  if (!submission) throw new Error('Submission no encontrada')

  const assets = await listEvidenceAssets(submissionId)
  const existing = asset.idempotency_key
    ? await findAssetByIdempotency(submissionId, asset.idempotency_key)
    : null

  const evaluation = evaluateConfirmUpload({
    evidence_type: String(submission.evidence_type),
    asset_count: assets.length,
    mime_type: asset.mime_type,
    permissions: defaultPermissions(),
    idempotency_key: asset.idempotency_key,
    existing_asset_idempotency: Boolean(existing),
  })

  await recordIntakeEvaluationRun({
    submissionId,
    action: 'confirm_upload',
    idempotencyKey: asset.idempotency_key,
    decision: evaluation.ok ? 'allowed' : 'rejected',
    warnings: evaluation.warnings,
  })

  if (!evaluation.ok) throw new Error(evaluation.reasons.join('; '))
  if (evaluation.idempotent_replay && existing) {
    return { ok: true, asset: existing, idempotent_replay: true }
  }

  const inserted = await insertEvidenceAsset({
    submission_id: submissionId,
    storage_path: asset.storage_path,
    asset,
  })

  await updateSubmissionStatus({ submissionId, status: 'processing' })
  await recordIntakeEvent({
    submissionId,
    eventType: 'upload_confirmed',
    actorId: asset.actor_id ?? null,
    payload: { asset_id: inserted.id, checksum: asset.checksum_sha256 },
  })
  await enqueueEvidenceProcessingJob(submissionId)

  return { ok: true, asset: inserted, idempotent_replay: false }
}

export async function addStructuredObservation(
  submissionId: string,
  input: StructuredObservationInput & { actor_id?: string | null },
) {
  const submission = await getEvidenceSubmissionById(submissionId)
  if (!submission) throw new Error('Submission no encontrada')

  const notes = String(input.fields.observer_notes ?? '')
  if (notes) assertSafeEvidenceCopy(notes)

  const observation = await upsertEvidenceObservation({
    submission_id: submissionId,
    schema: FIRE_STRUCTURED_OBSERVATION_SCHEMA,
    observation: input,
  })

  await recordIntakeEvent({
    submissionId,
    eventType: 'observation_added',
    actorId: input.actor_id ?? null,
    payload: { schema: FIRE_STRUCTURED_OBSERVATION_SCHEMA },
  })
  await updateSubmissionStatus({ submissionId, status: 'processing' })
  await enqueueEvidenceProcessingJob(submissionId)

  return { ok: true, observation }
}

export async function withdrawEvidenceSubmission(
  submissionId: string,
  input: { reason: string; actor_id?: string | null; idempotency_key?: string | null },
) {
  const submission = await getEvidenceSubmissionById(submissionId)
  if (!submission) throw new Error('Submission no encontrada')

  const evaluation = evaluateWithdrawSubmission({
    submission_status: submission.status as import('@/modules/evidence/evidence-intake.types').EvidenceSubmissionStatus,
    submitted_by_id: String(submission.submitted_by_id),
    actor_id: input.actor_id ?? null,
    permissions: defaultPermissions(),
    reason: input.reason,
    idempotency_key: input.idempotency_key,
    existing_idempotency_key: submission.idempotency_key as string | null,
  })

  await recordIntakeEvaluationRun({
    submissionId,
    action: 'withdraw',
    idempotencyKey: input.idempotency_key,
    decision: evaluation.ok ? 'allowed' : 'rejected',
    warnings: evaluation.warnings,
  })

  if (!evaluation.ok) throw new Error(evaluation.reasons.join('; '))
  if (evaluation.idempotent_replay) return evaluation

  await updateSubmissionStatus({ submissionId, status: 'withdrawn' })
  await recordIntakeEvent({
    submissionId,
    eventType: 'withdrawn',
    actorId: input.actor_id ?? null,
    payload: { reason: input.reason },
  })

  return evaluation
}

export async function processEvidenceSubmission(submissionId: string): Promise<void> {
  return runEvidenceProcessing(submissionId)
}

export async function getEvidenceSubmissionDetail(submissionId: string) {
  const submission = await getEvidenceSubmissionById(submissionId)
  if (!submission) return null
  const [assets, observation, links, events] = await Promise.all([
    listEvidenceAssets(submissionId),
    getEvidenceObservation(submissionId),
    listRequirementLinks(submissionId),
    listIntakeEvents(submissionId),
  ])
  return { submission, assets, observation, requirement_links: links, intake_events: events }
}

export async function getMissionEvidenceBundle(missionId: string) {
  const [submissions, requirements] = await Promise.all([
    listEvidenceSubmissionsByMission(missionId),
    listMissionEvidenceRequirements(missionId),
  ])
  const linksBySubmission = await Promise.all(
    submissions.map((s) => listRequirementLinks(String(s.id))),
  )
  const coverage = computeEvidenceCoverage({
    mission_id: missionId,
    requirements: mapRequirements(requirements as Array<Record<string, unknown>>),
    submissions: submissions.map((s, i) => ({
      id: String(s.id),
      status: String(s.status),
      evidence_type: String(s.evidence_type),
      linked_requirement_ids: linksBySubmission[i].map((l) => String(l.requirement_id)),
    })),
    now_iso: new Date().toISOString(),
  })
  return {
    submissions,
    requirements,
    coverage,
    generated_at: new Date().toISOString(),
  }
}

export async function getMissionEvidenceCoverage(missionId: string): Promise<EvidenceCoverageSnapshot> {
  const bundle = await getMissionEvidenceBundle(missionId)
  return bundle.coverage
}

export async function getTaskEvidence(taskId: string) {
  const submissions = await listEvidenceSubmissionsByTask(taskId)
  return { items: submissions, generated_at: new Date().toISOString() }
}

export async function getIncidentEvidence(incidentId: string) {
  const submissions = await listEvidenceSubmissionsByIncident(incidentId)
  return { items: submissions, generated_at: new Date().toISOString() }
}
