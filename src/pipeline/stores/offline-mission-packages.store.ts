import { FIRE_OFFLINE_PACKAGE_MODEL_VERSION } from '@/modules/field-operations/offline-packages/config/fire-offline-package.config'
import type { OfflinePackageManifest } from '@/modules/field-operations/offline-packages/offline-package.types'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export interface OfflineMissionPackageRow {
  id: string
  mission_id: string
  assignment_id: string | null
  status: string
  package_version: number
  offline_package_model_version: string
  manifest: OfflinePackageManifest | Record<string, unknown>
  manifest_checksum: string
  signature: string
  storage_path: string | null
  size_bytes: number
  generated_at: string | null
  generated_by: string | null
  valid_from: string
  valid_until: string
  download_expires_at: string | null
  revoked_at: string | null
  revocation_reason: string | null
  supersedes_package_id: string | null
  context_signature: string
  created_at: string
  updated_at: string
}

const ACTIVE_PACKAGE_STATUSES = ['queued', 'generating', 'ready', 'downloaded']

export async function getOfflinePackageById(id: string): Promise<OfflineMissionPackageRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('offline_mission_packages')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as OfflineMissionPackageRow | null) ?? null
}

export async function getActiveOfflinePackageBySignature(input: {
  missionId: string
  contextSignature: string
}): Promise<OfflineMissionPackageRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('offline_mission_packages')
    .select('*')
    .eq('mission_id', input.missionId)
    .eq('context_signature', input.contextSignature)
    .eq('offline_package_model_version', FIRE_OFFLINE_PACKAGE_MODEL_VERSION)
    .in('status', ACTIVE_PACKAGE_STATUSES)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as OfflineMissionPackageRow | null) ?? null
}

export async function listOfflinePackagesForMission(
  missionId: string,
): Promise<OfflineMissionPackageRow[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('offline_mission_packages')
    .select('*')
    .eq('mission_id', missionId)
    .order('package_version', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as OfflineMissionPackageRow[]) ?? []
}

export async function listPackageVersionsForMission(missionId: string): Promise<number[]> {
  const rows = await listOfflinePackagesForMission(missionId)
  return rows.map((r) => r.package_version)
}

export async function createOfflinePackageQueued(input: {
  id: string
  missionId: string
  assignmentId?: string | null
  packageVersion: number
  contextSignature: string
  validFrom: string
  validUntil: string
  downloadExpiresAt: string
  supersedesPackageId?: string | null
}): Promise<string> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('offline_mission_packages')
    .insert({
      id: input.id,
      mission_id: input.missionId,
      assignment_id: input.assignmentId ?? null,
      status: 'queued',
      package_version: input.packageVersion,
      offline_package_model_version: FIRE_OFFLINE_PACKAGE_MODEL_VERSION,
      manifest: {},
      manifest_checksum: '',
      signature: '',
      valid_from: input.validFrom,
      valid_until: input.validUntil,
      download_expires_at: input.downloadExpiresAt,
      supersedes_package_id: input.supersedesPackageId ?? null,
      context_signature: input.contextSignature,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return String(data.id)
}

export async function markOfflinePackageGenerating(packageId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('offline_mission_packages')
    .update({ status: 'generating', updated_at: new Date().toISOString() })
    .eq('id', packageId)
    .in('status', ['queued'])
  if (error) throw new Error(error.message)
}

export async function completeOfflinePackageGeneration(input: {
  packageId: string
  manifest: OfflinePackageManifest
  sizeBytes: number
  generatedAt: string
  generatedBy: string | null
  storagePath?: string | null
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('offline_mission_packages')
    .update({
      status: 'ready',
      manifest: input.manifest,
      manifest_checksum: input.manifest.manifest_sha256,
      signature: input.manifest.signature,
      size_bytes: input.sizeBytes,
      generated_at: input.generatedAt,
      generated_by: input.generatedBy,
      storage_path: input.storagePath ?? null,
      updated_at: now,
    })
    .eq('id', input.packageId)
    .in('status', ['generating', 'queued'])
  if (error) throw new Error(error.message)
}

export async function failOfflinePackageGeneration(input: {
  packageId: string
  reason: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('offline_mission_packages')
    .update({
      status: 'generation_failed',
      revocation_reason: input.reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.packageId)
  if (error) throw new Error(error.message)
}

export async function supersedeOfflinePackage(input: {
  packageId: string
  reason?: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('offline_mission_packages')
    .update({
      status: 'superseded',
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.packageId)
    .in('status', ['ready', 'downloaded'])
  if (error) throw new Error(error.message)
}

export async function revokeOfflinePackage(input: {
  packageId: string
  reason: string
  actorId?: string | null
}): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('offline_mission_packages')
    .update({
      status: 'revoked',
      revoked_at: now,
      revocation_reason: input.reason,
      updated_at: now,
    })
    .eq('id', input.packageId)
    .neq('status', 'revoked')
    .select('id')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data?.id)
}

export async function expireOfflinePackages(nowIso: string): Promise<number> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('offline_mission_packages')
    .update({ status: 'expired', updated_at: nowIso })
    .in('status', ['ready', 'downloaded'])
    .lt('valid_until', nowIso)
    .select('id')
  if (error) throw new Error(error.message)
  return data?.length ?? 0
}

export async function persistOfflinePackageFiles(input: {
  packageId: string
  files: Array<{
    path: string
    mime_type: string
    content: string
    sha256: string
  }>
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  for (const file of input.files) {
    const { error } = await supabase.from('offline_package_files').insert({
      package_id: input.packageId,
      path: file.path,
      mime_type: file.mime_type,
      size_bytes: Buffer.byteLength(file.content, 'utf8'),
      sha256: file.sha256,
      content_text: file.path.endsWith('.json') ? file.content : null,
      content: file.path.endsWith('.json') ? JSON.parse(file.content) : null,
    })
    if (error) throw new Error(error.message)
  }
}

export async function listOfflinePackageFiles(packageId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('offline_package_files')
    .select('path, mime_type, size_bytes, sha256, content_text')
    .eq('package_id', packageId)
    .order('path', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function recordOfflinePackageEvent(input: {
  packageId?: string | null
  missionId: string
  assignmentId?: string | null
  eventType: string
  actorType?: 'system' | 'user'
  actorId?: string | null
  payload?: Record<string, unknown>
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('offline_package_events').insert({
    package_id: input.packageId ?? null,
    mission_id: input.missionId,
    assignment_id: input.assignmentId ?? null,
    event_type: input.eventType,
    actor_type: input.actorType ?? 'system',
    actor_id: input.actorId ?? null,
    payload: input.payload ?? {},
    offline_package_model_version: FIRE_OFFLINE_PACKAGE_MODEL_VERSION,
  })
  if (error) throw new Error(error.message)
}

export async function recordOfflinePackageGenerationRun(input: {
  packageId?: string | null
  missionId: string
  contextSignature: string
  idempotencyKey?: string | null
  decision: string
  warnings: string[]
  redactionSummary: Record<string, unknown>
  evaluatedAt: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('offline_package_generation_runs').insert({
    package_id: input.packageId ?? null,
    mission_id: input.missionId,
    offline_package_model_version: FIRE_OFFLINE_PACKAGE_MODEL_VERSION,
    context_signature: input.contextSignature,
    idempotency_key: input.idempotencyKey ?? null,
    decision: input.decision,
    warnings: input.warnings,
    redaction_summary: input.redactionSummary,
    evaluated_at: input.evaluatedAt,
  })
  if (error) {
    if (error.code === '23505') return
    throw new Error(error.message)
  }
}

export async function recordOfflinePackageDownload(input: {
  packageId: string
  userId?: string | null
  teamId?: string | null
  devicePseudonym?: string | null
  checksumVerified?: boolean | null
  appVersion?: string | null
  idempotencyKey?: string | null
  completed?: boolean
}): Promise<{ created: boolean; download_id: string | null }> {
  const supabase = getSupabaseAdmin()
  if (input.idempotencyKey) {
    const { data: existing } = await supabase
      .from('offline_package_downloads')
      .select('id')
      .eq('package_id', input.packageId)
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle()
    if (existing?.id) return { created: false, download_id: String(existing.id) }
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('offline_package_downloads')
    .insert({
      package_id: input.packageId,
      user_id: input.userId ?? null,
      team_id: input.teamId ?? null,
      device_pseudonym: input.devicePseudonym ?? null,
      checksum_verified: input.checksumVerified ?? null,
      app_version: input.appVersion ?? null,
      idempotency_key: input.idempotencyKey ?? null,
      download_completed_at: input.completed ? now : null,
    })
    .select('id')
    .maybeSingle()
  if (error) {
    if (error.code === '23505') return { created: false, download_id: null }
    throw new Error(error.message)
  }

  if (input.completed) {
    await supabase
      .from('offline_mission_packages')
      .update({ status: 'downloaded', updated_at: now })
      .eq('id', input.packageId)
      .eq('status', 'ready')
  }

  return { created: true, download_id: (data?.id as string) ?? null }
}

export async function listOfflinePackageEvents(packageId: string, limit = 50) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('offline_package_events')
    .select('*')
    .eq('package_id', packageId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data ?? []
}
