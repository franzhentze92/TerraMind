import { randomUUID } from 'node:crypto'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import type {
  EvidenceAssetInput,
  EvidenceRequirementLinkResult,
  EvidenceSubmissionInput,
  EvidenceSubmissionStatus,
  StructuredObservationInput,
} from '@/modules/evidence/evidence-intake.types'
import { EVIDENCE_INTAKE_PROFILE_VERSION, SUBMISSION_UPLOAD_EXPIRY_HOURS } from '@/modules/evidence/config/fire-evidence-intake.config'

function uploadExpiryIso(): string {
  return new Date(Date.now() + SUBMISSION_UPLOAD_EXPIRY_HOURS * 3600_000).toISOString()
}

export async function findSubmissionByIdempotency(
  missionId: string,
  idempotencyKey: string,
) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('evidence_submissions')
    .select('*')
    .eq('mission_id', missionId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function insertEvidenceSubmission(input: {
  command: EvidenceSubmissionInput
  incident_id: string
  verification_plan_id: string
  context_signature: string
}): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('evidence_submissions')
    .insert({
      mission_id: input.command.mission_id,
      mission_task_id: input.command.mission_task_id ?? null,
      incident_id: input.incident_id,
      verification_plan_id: input.verification_plan_id,
      verification_need_id: input.command.verification_need_id ?? null,
      submitted_by_type: 'user',
      submitted_by_id: input.command.actor.actor_id ?? 'system',
      source_type: input.command.source_type,
      evidence_type: input.command.evidence_type,
      status: 'received',
      captured_at: input.command.captured_at ?? null,
      device_timestamp: input.command.device_timestamp ?? null,
      submitted_at: now,
      received_at: now,
      location_geometry: input.command.location?.geometry ?? null,
      device_location_geometry: input.command.location?.device_geometry ?? null,
      location_accuracy_m: input.command.location?.accuracy_m ?? null,
      location_method: input.command.location?.method ?? null,
      source_device: input.command.source_device ?? null,
      source_application: input.command.source_application ?? null,
      description: input.command.description ?? '',
      metadata: input.command.metadata ?? {},
      sensitivity_classification: input.command.sensitivity_classification ?? 'internal',
      intake_profile_version: EVIDENCE_INTAKE_PROFILE_VERSION,
      context_signature: input.context_signature,
      idempotency_key: input.command.idempotency_key ?? null,
      upload_expires_at: uploadExpiryIso(),
      updated_at: now,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as Record<string, unknown>
}

export async function getEvidenceSubmissionById(id: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('evidence_submissions')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function listEvidenceSubmissionsByMission(missionId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('evidence_submissions')
    .select('*')
    .eq('mission_id', missionId)
    .order('submitted_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listEvidenceSubmissionsByIncident(incidentId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('evidence_submissions')
    .select('*')
    .eq('incident_id', incidentId)
    .order('submitted_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listEvidenceSubmissionsByTask(taskId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('evidence_submissions')
    .select('*')
    .eq('mission_task_id', taskId)
    .order('submitted_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listEvidenceAssets(submissionId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('evidence_assets')
    .select('*')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getEvidenceObservation(submissionId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('evidence_observations')
    .select('*')
    .eq('submission_id', submissionId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function listRequirementLinks(submissionId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('evidence_requirement_links')
    .select('*')
    .eq('submission_id', submissionId)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listIntakeEvents(submissionId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('evidence_intake_events')
    .select('*')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listExistingAssetFingerprints(missionId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('evidence_assets')
    .select(
      'id, submission_id, checksum_sha256, original_filename, evidence_submissions!inner(mission_id, submitted_by_id, submitted_at)',
    )
    .eq('evidence_submissions.mission_id', missionId)
    .eq('upload_confirmed', true)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const sub = row.evidence_submissions as unknown as Record<string, unknown>
    return {
      submission_id: row.submission_id as string,
      asset_id: row.id as string,
      checksum_sha256: row.checksum_sha256 as string,
      mission_id: sub.mission_id as string,
      submitted_by_id: sub.submitted_by_id as string,
      submitted_at: sub.submitted_at as string,
      original_filename: row.original_filename as string,
    }
  })
}

export function buildStoragePath(missionId: string, submissionId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
  return `missions/${missionId}/${submissionId}/${randomUUID()}-${safe}`
}

export async function createSignedUploadUrl(storagePath: string, ttlSeconds: number) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.storage
    .from('mission-evidence')
    .createSignedUploadUrl(storagePath, { upsert: false })
  if (error) throw new Error(error.message)
  return { ...data, expires_in: ttlSeconds, storage_path: storagePath }
}

export async function findAssetByIdempotency(submissionId: string, idempotencyKey: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('evidence_assets')
    .select('*')
    .eq('submission_id', submissionId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function insertEvidenceAsset(input: {
  submission_id: string
  storage_path: string
  asset: EvidenceAssetInput
}): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const assetType = input.asset.mime_type.startsWith('video')
    ? 'video'
    : input.asset.mime_type.startsWith('image')
      ? 'image'
      : 'document'

  const { data, error } = await supabase
    .from('evidence_assets')
    .insert({
      submission_id: input.submission_id,
      asset_type: assetType,
      storage_provider: 'supabase',
      storage_path: input.storage_path,
      original_filename: input.asset.original_filename,
      mime_type: input.asset.mime_type,
      size_bytes: input.asset.size_bytes,
      checksum_sha256: input.asset.checksum_sha256 ?? null,
      captured_at: input.asset.captured_at ?? null,
      uploaded_at: now,
      width: input.asset.width ?? null,
      height: input.asset.height ?? null,
      duration_seconds: input.asset.duration_seconds ?? null,
      embedded_metadata: input.asset.embedded_metadata ?? {},
      upload_confirmed: true,
      idempotency_key: input.asset.idempotency_key ?? null,
    })
    .select('*')
    .single()
  if (error) {
    if (error.code === '23505') {
      const existing = input.asset.idempotency_key
        ? await findAssetByIdempotency(input.submission_id, input.asset.idempotency_key)
        : null
      if (existing) return existing as Record<string, unknown>
    }
    throw new Error(error.message)
  }
  return data as Record<string, unknown>
}

export async function upsertEvidenceObservation(input: {
  submission_id: string
  schema: string
  observation: StructuredObservationInput
}) {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('evidence_observations')
    .upsert(
      {
        submission_id: input.submission_id,
        observation_schema: input.schema,
        fields: input.observation.fields,
        updated_at: now,
      },
      { onConflict: 'submission_id' },
    )
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function upsertRequirementLinks(
  submissionId: string,
  links: EvidenceRequirementLinkResult[],
) {
  if (links.length === 0) return []
  const supabase = getSupabaseAdmin()
  const rows = links.map((l) => ({
    submission_id: submissionId,
    requirement_id: l.requirement_id,
    match_type: l.match_type,
    match_score: l.match_score,
    match_reason: l.match_reason,
    preliminary_coverage: l.preliminary_coverage,
  }))
  const { data, error } = await supabase
    .from('evidence_requirement_links')
    .upsert(rows, { onConflict: 'submission_id,requirement_id' })
    .select('*')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function updateSubmissionStatus(input: {
  submissionId: string
  status: EvidenceSubmissionStatus
  processed_at?: string | null
  location_outside_mission_area?: boolean
  location_discrepancy_m?: number | null
}) {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = {
    status: input.status,
    updated_at: now,
  }
  if (input.processed_at !== undefined) updates.processed_at = input.processed_at
  if (input.location_outside_mission_area !== undefined) {
    updates.location_outside_mission_area = input.location_outside_mission_area
  }
  if (input.location_discrepancy_m !== undefined) {
    updates.location_discrepancy_m = input.location_discrepancy_m
  }
  const { error } = await supabase
    .from('evidence_submissions')
    .update(updates)
    .eq('id', input.submissionId)
  if (error) throw new Error(error.message)
}

export async function recordIntakeEvent(input: {
  submissionId: string
  eventType: string
  actorType?: 'system' | 'user'
  actorId?: string | null
  payload?: Record<string, unknown>
}) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('evidence_intake_events').insert({
    submission_id: input.submissionId,
    event_type: input.eventType,
    actor_type: input.actorType ?? 'user',
    actor_id: input.actorId ?? null,
    payload: input.payload ?? {},
    intake_profile_version: EVIDENCE_INTAKE_PROFILE_VERSION,
  })
  if (error) throw new Error(error.message)
}

export async function recordIntakeEvaluationRun(input: {
  submissionId: string
  action: string
  idempotencyKey?: string | null
  decision: string
  warnings: string[]
}) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('evidence_intake_evaluation_runs').insert({
    submission_id: input.submissionId,
    action: input.action,
    idempotency_key: input.idempotencyKey ?? null,
    decision: input.decision,
    warnings: input.warnings,
    evaluated_at: new Date().toISOString(),
  })
  if (error) {
    if (error.code === '23505') return
    throw new Error(error.message)
  }
}

export async function supersedeSubmission(input: {
  oldSubmissionId: string
  newSubmissionId: string
  reason: string
}) {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('evidence_submissions')
    .update({
      superseded_by_submission_id: input.newSubmissionId,
      updated_at: now,
    })
    .eq('id', input.oldSubmissionId)
  if (error) throw new Error(error.message)

  const { error: linkError } = await supabase
    .from('evidence_submissions')
    .update({
      supersedes_submission_id: input.oldSubmissionId,
      supersede_reason: input.reason,
      updated_at: now,
    })
    .eq('id', input.newSubmissionId)
  if (linkError) throw new Error(linkError.message)
}
