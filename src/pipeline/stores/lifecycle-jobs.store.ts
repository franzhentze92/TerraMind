import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import type { LifecycleEvaluationJobRow } from '@/pipeline/stores/lifecycle-jobs.types'

export async function insertLifecycleJob(input: {
  entity_id: string
  entity_type?: string
  requested_lifecycle_model_version: string
  max_attempts?: number
}): Promise<{ created: boolean; job_id: string | null }> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('event_lifecycle_jobs')
    .insert({
      entity_type: input.entity_type ?? 'fire_event',
      entity_id: input.entity_id,
      requested_lifecycle_model_version: input.requested_lifecycle_model_version,
      status: 'pending',
      max_attempts: input.max_attempts ?? 3,
      available_at: new Date().toISOString(),
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

export async function claimLifecycleJob(
  workerId: string,
  lockTimeoutMinutes: number,
): Promise<LifecycleEvaluationJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('claim_event_lifecycle_job', {
    p_worker_id: workerId,
    p_lock_timeout_minutes: lockTimeoutMinutes,
  })
  if (error) throw new Error(error.message)
  const rows = (data as LifecycleEvaluationJobRow[] | null) ?? []
  return rows[0] ?? null
}

export async function completeLifecycleJob(jobId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('event_lifecycle_jobs')
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

export async function failLifecycleJob(input: {
  jobId: string
  errorCode: string
  errorMessage: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('event_lifecycle_jobs')
    .update({
      status: 'failed',
      completed_at: now,
      locked_at: null,
      locked_by: null,
      last_error_code: input.errorCode,
      last_error_message: input.errorMessage,
      updated_at: now,
    })
    .eq('id', input.jobId)
    .eq('status', 'processing')
  if (error) throw new Error(error.message)
}

export async function rescheduleLifecycleJob(input: {
  jobId: string
  availableAt: string
  errorCode: string
  errorMessage: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('event_lifecycle_jobs')
    .update({
      status: 'pending',
      available_at: input.availableAt,
      locked_at: null,
      locked_by: null,
      last_error_code: input.errorCode,
      last_error_message: input.errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.jobId)
    .eq('status', 'processing')
  if (error) throw new Error(error.message)
}

export async function getActiveLifecycleJobForEntity(
  entityId: string,
): Promise<LifecycleEvaluationJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('event_lifecycle_jobs')
    .select('*')
    .eq('entity_type', 'fire_event')
    .eq('entity_id', entityId)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as LifecycleEvaluationJobRow | null) ?? null
}

export async function countLifecycleJobs(): Promise<Record<string, number>> {
  const supabase = getSupabaseAdmin()
  const counts: Record<string, number> = {}
  for (const status of ['pending', 'processing', 'completed', 'failed'] as const) {
    const { count, error } = await supabase
      .from('event_lifecycle_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', status)
    if (error) throw new Error(error.message)
    counts[status] = count ?? 0
  }
  return counts
}
