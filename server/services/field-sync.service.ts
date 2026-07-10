import { UPLOAD_URL_TTL_SECONDS } from '@/modules/evidence/config/fire-evidence-intake.config'
import {
  buildStoragePath,
  createSignedUploadUrl,
  getEvidenceSubmissionById,
  listEvidenceAssets,
  getEvidenceObservation,
  listRequirementLinks,
  recordIntakeEvent,
} from '@/pipeline/stores/evidence-intake.store'
import {
  findUploadSessionByIdempotency,
  getUploadSessionById,
  insertBundleRegistration,
  insertUploadSession,
  findBundleRegistrationByIdempotency,
  updateBundleRegistration,
  updateUploadSessionProgress,
  upsertRequirementLinksIdempotent,
} from '@/pipeline/stores/field-sync.store'
import { runEvidenceProcessing } from '@/pipeline/engines/evidence/evidence-intake-processing.runner'
import { getMissionById } from '@/pipeline/stores/missions.store'

function uploadExpiryIso(): string {
  return new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString()
}

export async function registerBundleSync(input: {
  bundle_id: string
  bundle_checksum: string
  mission_id: string
  package_id?: string | null
  package_version?: number | null
  task_id?: string | null
  idempotency_key: string
  metadata?: Record<string, unknown>
}) {
  const existing = await findBundleRegistrationByIdempotency(input.idempotency_key)
  if (existing) {
    return { registration_id: String(existing.id), idempotent_replay: true, registration: existing }
  }
  const mission = await getMissionById(input.mission_id)
  if (!mission) throw new Error('Misión no encontrada')
  if (mission.status === 'cancelled') throw new Error('mission_cancelled')

  const registration = await insertBundleRegistration(input)
  return { registration_id: String(registration.id), idempotent_replay: false, registration }
}

export async function startEvidenceUploadSession(
  submissionId: string,
  input: {
    local_asset_id?: string | null
    mime_type: string
    original_filename: string
    expected_size_bytes: number
    expected_checksum_sha256?: string | null
    idempotency_key: string
    actor_id?: string | null
  },
) {
  const submission = await getEvidenceSubmissionById(submissionId)
  if (!submission) throw new Error('Submission no encontrada')

  const existing = await findUploadSessionByIdempotency(submissionId, input.idempotency_key)
  if (existing) {
    const signed = await createSignedUploadUrl(String(existing.storage_path), UPLOAD_URL_TTL_SECONDS)
    return {
      upload_session_id: String(existing.id),
      upload_url: signed.signedUrl,
      storage_path: String(existing.storage_path),
      expires_at: uploadExpiryIso(),
      idempotent_replay: true,
      bytes_transferred: Number(existing.bytes_transferred ?? 0),
    }
  }

  const storagePath = buildStoragePath(
    String(submission.mission_id),
    submissionId,
    input.original_filename,
  )
  const session = await insertUploadSession({
    submission_id: submissionId,
    local_asset_id: input.local_asset_id ?? null,
    storage_path: storagePath,
    mime_type: input.mime_type,
    original_filename: input.original_filename,
    expected_size_bytes: input.expected_size_bytes,
    expected_checksum_sha256: input.expected_checksum_sha256 ?? null,
    idempotency_key: input.idempotency_key,
    expires_at: uploadExpiryIso(),
  })

  const signed = await createSignedUploadUrl(storagePath, UPLOAD_URL_TTL_SECONDS)
  await recordIntakeEvent({
    submissionId,
    eventType: 'upload_session_started',
    actorId: input.actor_id ?? null,
    payload: { upload_session_id: session.id, storage_path: storagePath },
  })

  return {
    upload_session_id: String(session.id),
    upload_url: signed.signedUrl,
    storage_path: storagePath,
    expires_at: uploadExpiryIso(),
    idempotent_replay: false,
    bytes_transferred: 0,
  }
}

export async function renewEvidenceUploadUrl(submissionId: string, uploadSessionId: string) {
  const session = await getUploadSessionById(uploadSessionId)
  if (!session || String(session.submission_id) !== submissionId) {
    throw new Error('Upload session no encontrada')
  }
  const signed = await createSignedUploadUrl(String(session.storage_path), UPLOAD_URL_TTL_SECONDS)
  await updateUploadSessionProgress({
    id: uploadSessionId,
    bytes_transferred: Number(session.bytes_transferred ?? 0),
    status: 'uploading',
  })
  await recordIntakeEvent({
    submissionId,
    eventType: 'upload_url_renewed',
    payload: { upload_session_id: uploadSessionId },
  })
  return { upload_url: signed.signedUrl, expires_at: uploadExpiryIso() }
}

export async function reportUploadProgress(
  submissionId: string,
  uploadSessionId: string,
  input: { bytes_transferred: number; status?: string },
) {
  const session = await getUploadSessionById(uploadSessionId)
  if (!session || String(session.submission_id) !== submissionId) {
    throw new Error('Upload session no encontrada')
  }
  await updateUploadSessionProgress({
    id: uploadSessionId,
    bytes_transferred: input.bytes_transferred,
    status: input.status ?? 'uploading',
  })
  return { ok: true, bytes_transferred: input.bytes_transferred }
}

export async function getUploadSessionStatus(submissionId: string, uploadSessionId: string) {
  const session = await getUploadSessionById(uploadSessionId)
  if (!session || String(session.submission_id) !== submissionId) {
    throw new Error('Upload session no encontrada')
  }
  return {
    status: String(session.status),
    bytes_transferred: Number(session.bytes_transferred ?? 0),
    expected_size_bytes: Number(session.expected_size_bytes ?? 0),
    expected_checksum_sha256: session.expected_checksum_sha256 as string | null,
  }
}

export async function linkSubmissionRequirements(
  submissionId: string,
  links: Array<{
    requirement_id: string
    match_type: string
    match_score: number
    match_reason: string
    preliminary_coverage: string
  }>,
) {
  const rows = await upsertRequirementLinksIdempotent(submissionId, links)
  await recordIntakeEvent({
    submissionId,
    eventType: 'requirement_links_synced',
    payload: { count: rows.length },
  })
  return { linked_count: rows.length }
}

export async function finalizeSubmissionIntake(submissionId: string, actorId?: string | null) {
  await runEvidenceProcessing(submissionId)
  const submission = await getEvidenceSubmissionById(submissionId)
  await recordIntakeEvent({
    submissionId,
    eventType: 'sync_finalize_requested',
    actorId: actorId ?? null,
    payload: { status: submission?.status },
  })
  return { status: String(submission?.status ?? 'processing') }
}

export async function getSubmissionReconciliation(submissionId: string) {
  const submission = await getEvidenceSubmissionById(submissionId)
  if (!submission) throw new Error('Submission no encontrada')
  const [assets, observation, links] = await Promise.all([
    listEvidenceAssets(submissionId),
    getEvidenceObservation(submissionId),
    listRequirementLinks(submissionId),
  ])
  return {
    submission_id: submissionId,
    status: String(submission.status),
    evidence_type: String(submission.evidence_type),
    assets: assets.map((a) => ({
      id: String(a.id),
      checksum_sha256: a.checksum_sha256 as string | null,
      size_bytes: Number(a.size_bytes),
    })),
    has_observation: Boolean(observation),
    requirement_link_count: links.length,
  }
}

export async function completeBundleRegistration(
  registrationId: string,
  input: { status: string; remote_submission_ids: string[] },
) {
  await updateBundleRegistration({
    id: registrationId,
    status: input.status,
    remote_submission_ids: input.remote_submission_ids,
    synced_at: input.status === 'synced' ? new Date().toISOString() : null,
  })
}

export async function markUploadSessionConfirmed(uploadSessionId: string) {
  const session = await getUploadSessionById(uploadSessionId)
  if (!session) return
  await updateUploadSessionProgress({
    id: uploadSessionId,
    bytes_transferred: Number(session.expected_size_bytes ?? session.bytes_transferred ?? 0),
    status: 'confirmed',
  })
}
