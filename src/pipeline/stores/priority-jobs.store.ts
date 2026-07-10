import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import type { PriorityEvaluationJobRow } from '@/pipeline/stores/priority-jobs.types'

export async function insertPriorityJob(input: {
  entity_id: string
  entity_type?: string
  requested_priority_model_version: string
  requested_context_version?: string | null
  priority?: number
  max_attempts?: number
}): Promise<{ created: boolean; job_id: string | null }> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('finding_priority_jobs')
    .insert({
      entity_type: input.entity_type ?? 'fire_event',
      entity_id: input.entity_id,
      requested_priority_model_version: input.requested_priority_model_version,
      requested_context_version: input.requested_context_version ?? null,
      status: 'pending',
      priority: input.priority ?? 0,
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

export async function claimPriorityJob(
  workerId: string,
  lockTimeoutMinutes: number,
): Promise<PriorityEvaluationJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('claim_finding_priority_job', {
    p_worker_id: workerId,
    p_lock_timeout_minutes: lockTimeoutMinutes,
  })
  if (error) throw new Error(error.message)
  const rows = (data as PriorityEvaluationJobRow[] | null) ?? []
  return rows[0] ?? null
}

export async function completePriorityJob(jobId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('finding_priority_jobs')
    .update({
      status: 'completed',
      completed_at: now,
      locked_at: null,
      locked_by: null,
      last_error_code: null,
      last_error_message: null,
      updated_at: now,
    })
    .eq('id', jobId)
    .eq('status', 'processing')
  if (error) throw new Error(error.message)
}

export async function failPriorityJob(input: {
  jobId: string
  errorCode: string
  errorMessage: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('finding_priority_jobs')
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

export async function reschedulePriorityJob(input: {
  jobId: string
  availableAt: string
  errorCode: string
  errorMessage: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('finding_priority_jobs')
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

export async function getActivePriorityJobForEntity(
  entityId: string,
): Promise<PriorityEvaluationJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('finding_priority_jobs')
    .select('*')
    .eq('entity_type', 'fire_event')
    .eq('entity_id', entityId)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as PriorityEvaluationJobRow | null) ?? null
}

export async function countPriorityJobs(): Promise<Record<string, number>> {
  const supabase = getSupabaseAdmin()
  const counts: Record<string, number> = {}
  for (const status of ['pending', 'processing', 'completed', 'failed'] as const) {
    const { count, error } = await supabase
      .from('finding_priority_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', status)
    if (error) throw new Error(error.message)
    counts[status] = count ?? 0
  }
  return counts
}
