import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import type { FindingEvaluationJobRow } from '@/pipeline/stores/finding-jobs.types'

export async function insertFindingJob(input: {
  entity_id: string
  entity_type?: string
  requested_rule_set_version: string
  requested_context_version?: string | null
  priority?: number
  max_attempts?: number
}): Promise<{ created: boolean; job_id: string | null }> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('finding_evaluation_jobs')
    .insert({
      entity_type: input.entity_type ?? 'fire_event',
      entity_id: input.entity_id,
      requested_rule_set_version: input.requested_rule_set_version,
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

export async function claimFindingJob(
  workerId: string,
  lockTimeoutMinutes: number,
): Promise<FindingEvaluationJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('claim_finding_evaluation_job', {
    p_worker_id: workerId,
    p_lock_timeout_minutes: lockTimeoutMinutes,
  })
  if (error) throw new Error(error.message)
  const rows = (data as FindingEvaluationJobRow[] | null) ?? []
  return rows[0] ?? null
}

export async function completeFindingJob(jobId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('finding_evaluation_jobs')
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

export async function failFindingJob(input: {
  jobId: string
  errorCode: string
  errorMessage: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('finding_evaluation_jobs')
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

export async function rescheduleFindingJob(input: {
  jobId: string
  availableAt: string
  errorCode: string
  errorMessage: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('finding_evaluation_jobs')
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

export async function getActiveFindingJobForEntity(
  entityId: string,
): Promise<FindingEvaluationJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('finding_evaluation_jobs')
    .select('*')
    .eq('entity_type', 'fire_event')
    .eq('entity_id', entityId)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as FindingEvaluationJobRow | null) ?? null
}

export async function countFindingJobs(): Promise<Record<string, number>> {
  const supabase = getSupabaseAdmin()
  const counts: Record<string, number> = {}
  for (const status of ['pending', 'processing', 'completed', 'failed'] as const) {
    const { count, error } = await supabase
      .from('finding_evaluation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', status)
    if (error) throw new Error(error.message)
    counts[status] = count ?? 0
  }
  return counts
}
