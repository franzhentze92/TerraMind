import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import type {
  ClimateEnrichmentJobRow,
  ClimateJobCounts,
} from '@/pipeline/stores/climate-jobs.types'

export interface CreateClimateJobInput {
  entity_type?: string
  entity_id: string
  requested_context_version: string
  priority?: number
  max_attempts?: number
}

export async function insertClimateJob(
  input: CreateClimateJobInput,
): Promise<{ created: boolean; job_id: string | null }> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('climate_enrichment_jobs')
    .insert({
      entity_type: input.entity_type ?? 'fire_event',
      entity_id: input.entity_id,
      requested_context_version: input.requested_context_version,
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

export async function claimClimateJob(
  workerId: string,
  lockTimeoutMinutes: number,
): Promise<ClimateEnrichmentJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('claim_climate_enrichment_job', {
    p_worker_id: workerId,
    p_lock_timeout_minutes: lockTimeoutMinutes,
  })
  if (error) throw new Error(error.message)
  const rows = (data as ClimateEnrichmentJobRow[] | null) ?? []
  return rows[0] ?? null
}

export async function completeClimateJob(jobId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('climate_enrichment_jobs')
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

export async function rescheduleClimateJob(input: {
  jobId: string
  availableAt: string
  errorCode: string
  errorMessage: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('climate_enrichment_jobs')
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

export async function failClimateJob(input: {
  jobId: string
  errorCode: string
  errorMessage: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('climate_enrichment_jobs')
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

export async function getActiveClimateJobForEvent(
  eventId: string,
): Promise<ClimateEnrichmentJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('climate_enrichment_jobs')
    .select('*')
    .eq('entity_type', 'fire_event')
    .eq('entity_id', eventId)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as ClimateEnrichmentJobRow | null) ?? null
}

export async function countClimateJobsByStatus(): Promise<ClimateJobCounts> {
  const supabase = getSupabaseAdmin()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const lockStaleBefore = new Date(Date.now() - 30 * 60 * 1000).toISOString()

  const [pendingRes, processingRes, completedRes, failedRes, staleRes] = await Promise.all([
    supabase.from('climate_enrichment_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('climate_enrichment_jobs').select('id', { count: 'exact', head: true }).eq('status', 'processing'),
    supabase
      .from('climate_enrichment_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', since24h),
    supabase.from('climate_enrichment_jobs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase
      .from('climate_enrichment_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'processing')
      .lt('locked_at', lockStaleBefore),
  ])

  for (const res of [pendingRes, processingRes, completedRes, failedRes, staleRes]) {
    if (res.error) throw new Error(res.error.message)
  }

  return {
    pending: pendingRes.count ?? 0,
    processing: processingRes.count ?? 0,
    completed_24h: completedRes.count ?? 0,
    failed: failedRes.count ?? 0,
    stale_locks: staleRes.count ?? 0,
  }
}
