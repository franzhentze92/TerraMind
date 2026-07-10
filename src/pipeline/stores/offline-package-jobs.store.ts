import { FIRE_OFFLINE_PACKAGE_MODEL_VERSION } from '@/modules/field-operations/offline-packages/config/fire-offline-package.config'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export interface OfflinePackageJobRow {
  id: string
  mission_id: string
  assignment_id: string | null
  offline_package_model_version: string
  context_signature: string
  status: string
  priority: number
  attempts: number
  max_attempts: number
  available_at: string
  locked_at: string | null
  locked_by: string | null
  started_at: string | null
  completed_at: string | null
  last_error_code: string | null
  last_error_message: string | null
  idempotency_key: string | null
  requested_by: string | null
  created_at: string
  updated_at: string
}

export async function enqueueOfflinePackageJob(input: {
  missionId: string
  assignmentId?: string | null
  contextSignature?: string
  priority?: number
  idempotencyKey?: string | null
  requestedBy?: string | null
}): Promise<{ created: boolean; job_id: string | null }> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('offline_package_jobs')
    .insert({
      mission_id: input.missionId,
      assignment_id: input.assignmentId ?? null,
      offline_package_model_version: FIRE_OFFLINE_PACKAGE_MODEL_VERSION,
      context_signature: input.contextSignature ?? '',
      status: 'pending',
      priority: input.priority ?? 0,
      max_attempts: 3,
      available_at: new Date().toISOString(),
      idempotency_key: input.idempotencyKey ?? null,
      requested_by: input.requestedBy ?? null,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle()
  if (error) {
    if (error.code === '23505') return { created: false, job_id: null }
    throw new Error(error.message)
  }
  return { created: true, job_id: (data?.id as string) ?? null }
}

export async function claimOfflinePackageJob(
  workerId: string,
  lockTimeoutMinutes: number,
): Promise<OfflinePackageJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('claim_offline_package_job', {
    p_worker_id: workerId,
    p_lock_timeout_minutes: lockTimeoutMinutes,
  })
  if (error) throw new Error(error.message)
  const rows = (data as OfflinePackageJobRow[] | null) ?? []
  return rows[0] ?? null
}

export async function completeOfflinePackageJob(jobId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('offline_package_jobs')
    .update({
      status: 'completed',
      completed_at: now,
      locked_at: null,
      locked_by: null,
      updated_at: now,
    })
    .eq('id', jobId)
    .eq('status', 'processing')
  if (error) throw new Error(error.message)
}

export async function failOfflinePackageJob(input: {
  jobId: string
  errorCode: string
  errorMessage: string
  rescheduleAt?: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data: job, error: fetchError } = await supabase
    .from('offline_package_jobs')
    .select('attempts, max_attempts')
    .eq('id', input.jobId)
    .single()
  if (fetchError) throw new Error(fetchError.message)

  const attempts = (job?.attempts as number) ?? 0
  const maxAttempts = (job?.max_attempts as number) ?? 3
  const terminal = attempts >= maxAttempts

  const { error } = await supabase
    .from('offline_package_jobs')
    .update({
      status: terminal ? 'failed' : 'pending',
      available_at: terminal ? now : (input.rescheduleAt ?? now),
      locked_at: null,
      locked_by: null,
      last_error_code: input.errorCode,
      last_error_message: input.errorMessage,
      updated_at: now,
    })
    .eq('id', input.jobId)
  if (error) throw new Error(error.message)
}

export async function cancelOfflinePackageJobsForMission(missionId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('offline_package_jobs')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('mission_id', missionId)
    .in('status', ['pending', 'processing'])
  if (error) throw new Error(error.message)
}

export async function listPendingOfflinePackageJobs(limit = 20) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('offline_package_jobs')
    .select('*')
    .in('status', ['pending', 'processing', 'failed'])
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data ?? []
}
