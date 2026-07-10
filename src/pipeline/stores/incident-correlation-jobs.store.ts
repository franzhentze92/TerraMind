import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import type { IncidentCorrelationJobRow } from '@/pipeline/stores/incident-correlation-jobs.types'

export async function insertIncidentCorrelationJob(input: {
  event_id: string
  event_type?: string
  requested_correlation_model_version: string
  max_attempts?: number
}): Promise<{ created: boolean; job_id: string | null }> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('incident_correlation_jobs')
    .insert({
      event_type: input.event_type ?? 'fire_event',
      event_id: input.event_id,
      requested_correlation_model_version: input.requested_correlation_model_version,
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

export async function claimIncidentCorrelationJob(
  workerId: string,
  lockTimeoutMinutes: number,
): Promise<IncidentCorrelationJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('claim_incident_correlation_job', {
    p_worker_id: workerId,
    p_lock_timeout_minutes: lockTimeoutMinutes,
  })
  if (error) throw new Error(error.message)
  const rows = (data as IncidentCorrelationJobRow[] | null) ?? []
  return rows[0] ?? null
}

export async function completeIncidentCorrelationJob(jobId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('incident_correlation_jobs')
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

export async function failIncidentCorrelationJob(input: {
  jobId: string
  errorCode: string
  errorMessage: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('incident_correlation_jobs')
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

export async function rescheduleIncidentCorrelationJob(input: {
  jobId: string
  availableAt: string
  errorCode: string
  errorMessage: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('incident_correlation_jobs')
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

export async function getActiveIncidentCorrelationJobForEvent(
  eventId: string,
): Promise<IncidentCorrelationJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('incident_correlation_jobs')
    .select('*')
    .eq('event_type', 'fire_event')
    .eq('event_id', eventId)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as IncidentCorrelationJobRow | null) ?? null
}

export async function countIncidentCorrelationJobs(): Promise<Record<string, number>> {
  const supabase = getSupabaseAdmin()
  const counts: Record<string, number> = {}
  for (const status of ['pending', 'processing', 'completed', 'failed'] as const) {
    const { count, error } = await supabase
      .from('incident_correlation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', status)
    if (error) throw new Error(error.message)
    counts[status] = count ?? 0
  }
  return counts
}
