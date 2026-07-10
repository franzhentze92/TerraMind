import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import type {
  PopulationEnrichmentJobRow,
  PopulationJobCounts,
} from '@/pipeline/stores/population-jobs.types'

export interface CreatePopulationJobInput {
  entity_type?: string
  entity_id: string
  requested_context_version: string
  priority?: number
  max_attempts?: number
}

export async function insertPopulationJob(
  input: CreatePopulationJobInput,
): Promise<{ created: boolean; job_id: string | null }> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('population_enrichment_jobs')
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

export async function claimPopulationJob(
  workerId: string,
  lockTimeoutMinutes: number,
): Promise<PopulationEnrichmentJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('claim_population_enrichment_job', {
    p_worker_id: workerId,
    p_lock_timeout_minutes: lockTimeoutMinutes,
  })
  if (error) throw new Error(error.message)
  const rows = (data as PopulationEnrichmentJobRow[] | null) ?? []
  return rows[0] ?? null
}

export async function completePopulationJob(jobId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('population_enrichment_jobs')
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

export async function reschedulePopulationJob(input: {
  jobId: string
  availableAt: string
  errorCode: string
  errorMessage: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('population_enrichment_jobs')
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

export async function failPopulationJob(input: {
  jobId: string
  errorCode: string
  errorMessage: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('population_enrichment_jobs')
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

export async function getActivePopulationJobForEvent(
  eventId: string,
): Promise<PopulationEnrichmentJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('population_enrichment_jobs')
    .select('*')
    .eq('entity_type', 'fire_event')
    .eq('entity_id', eventId)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as PopulationEnrichmentJobRow | null) ?? null
}

export async function countPopulationJobsByStatus(): Promise<PopulationJobCounts> {
  const supabase = getSupabaseAdmin()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const lockStaleBefore = new Date(Date.now() - 30 * 60 * 1000).toISOString()

  const [pendingRes, processingRes, completedRes, failedRes, staleRes] = await Promise.all([
    supabase.from('population_enrichment_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('population_enrichment_jobs').select('id', { count: 'exact', head: true }).eq('status', 'processing'),
    supabase
      .from('population_enrichment_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', since24h),
    supabase.from('population_enrichment_jobs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase
      .from('population_enrichment_jobs')
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
