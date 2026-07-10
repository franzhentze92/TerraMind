import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export async function findUploadSessionByIdempotency(submissionId: string, idempotencyKey: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('evidence_upload_sessions')
    .select('*')
    .eq('submission_id', submissionId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function insertUploadSession(input: {
  submission_id: string
  local_asset_id?: string | null
  storage_path: string
  mime_type: string
  original_filename: string
  expected_size_bytes: number
  expected_checksum_sha256?: string | null
  idempotency_key: string
  expires_at: string
}) {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('evidence_upload_sessions')
    .insert({
      submission_id: input.submission_id,
      local_asset_id: input.local_asset_id ?? null,
      storage_path: input.storage_path,
      mime_type: input.mime_type,
      original_filename: input.original_filename,
      expected_size_bytes: input.expected_size_bytes,
      expected_checksum_sha256: input.expected_checksum_sha256 ?? null,
      idempotency_key: input.idempotency_key,
      expires_at: input.expires_at,
      status: 'pending',
      bytes_transferred: 0,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()
  if (error) {
    if (error.code === '23505') {
      const existing = await findUploadSessionByIdempotency(input.submission_id, input.idempotency_key)
      if (existing) return existing
    }
    throw new Error(error.message)
  }
  return data
}

export async function getUploadSessionById(id: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('evidence_upload_sessions').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function updateUploadSessionProgress(input: {
  id: string
  bytes_transferred: number
  status: string
  last_error?: string | null
}) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('evidence_upload_sessions')
    .update({
      bytes_transferred: input.bytes_transferred,
      status: input.status,
      last_error: input.last_error ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
  if (error) throw new Error(error.message)
}

export async function findBundleRegistrationByIdempotency(idempotencyKey: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('evidence_bundle_sync_registrations')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function insertBundleRegistration(input: {
  bundle_id: string
  bundle_checksum: string
  mission_id: string
  package_id?: string | null
  package_version?: number | null
  task_id?: string | null
  idempotency_key: string
  metadata?: Record<string, unknown>
  organization_id?: string | null
}) {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const row: Record<string, unknown> = {
      bundle_id: input.bundle_id,
      bundle_checksum: input.bundle_checksum,
      mission_id: input.mission_id,
      package_id: input.package_id ?? null,
      package_version: input.package_version ?? null,
      task_id: input.task_id ?? null,
      status: 'registered',
      idempotency_key: input.idempotency_key,
      metadata: input.metadata ?? {},
      created_at: now,
      updated_at: now,
  }
  if (input.organization_id) row.organization_id = input.organization_id
  const { data, error } = await supabase
    .from('evidence_bundle_sync_registrations')
    .insert(row)
    .select('*')
    .single()
  if (error) {
    if (error.code === '23505') {
      const existing = await findBundleRegistrationByIdempotency(input.idempotency_key)
      if (existing) return existing
    }
    throw new Error(error.message)
  }
  return data
}

export async function updateBundleRegistration(input: {
  id: string
  status: string
  remote_submission_ids?: string[]
  synced_at?: string | null
}) {
  const supabase = getSupabaseAdmin()
  const updates: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  }
  if (input.remote_submission_ids) updates.remote_submission_ids = input.remote_submission_ids
  if (input.synced_at !== undefined) updates.synced_at = input.synced_at
  const { error } = await supabase.from('evidence_bundle_sync_registrations').update(updates).eq('id', input.id)
  if (error) throw new Error(error.message)
}

export async function upsertRequirementLinksIdempotent(
  submissionId: string,
  links: Array<{
    requirement_id: string
    match_type: string
    match_score: number
    match_reason: string
    preliminary_coverage: string
  }>,
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
