import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export interface VerificationPlanJobRow {
  id: string
  incident_id: string
  requested_verification_model_version: string
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
  created_at: string
  updated_at: string
}

export async function insertVerificationPlanJob(input: {
  incident_id: string
  requested_verification_model_version: string
  max_attempts?: number
  priority?: number
}): Promise<{ created: boolean; job_id: string | null }> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('verification_plan_jobs')
    .insert({
      incident_id: input.incident_id,
      requested_verification_model_version: input.requested_verification_model_version,
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

export async function claimVerificationPlanJob(
  workerId: string,
  lockTimeoutMinutes: number,
): Promise<VerificationPlanJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('claim_verification_plan_job', {
    p_worker_id: workerId,
    p_lock_timeout_minutes: lockTimeoutMinutes,
  })
  if (error) throw new Error(error.message)
  const rows = (data as VerificationPlanJobRow[] | null) ?? []
  return rows[0] ?? null
}

export async function completeVerificationPlanJob(jobId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('verification_plan_jobs')
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

export async function failVerificationPlanJob(input: {
  jobId: string
  errorCode: string
  errorMessage: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('verification_plan_jobs')
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

export async function rescheduleVerificationPlanJob(input: {
  jobId: string
  availableAt: string
  errorCode: string
  errorMessage: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('verification_plan_jobs')
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

export async function getActiveVerificationPlanJobForIncident(
  incidentId: string,
): Promise<VerificationPlanJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('verification_plan_jobs')
    .select('*')
    .eq('incident_id', incidentId)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as VerificationPlanJobRow | null) ?? null
}

export async function countVerificationPlanJobs(): Promise<Record<string, number>> {
  const supabase = getSupabaseAdmin()
  const counts: Record<string, number> = {}
  for (const status of ['pending', 'processing', 'completed', 'failed'] as const) {
    const { count, error } = await supabase
      .from('verification_plan_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', status)
    if (error) throw new Error(error.message)
    counts[status] = count ?? 0
  }
  return counts
}
