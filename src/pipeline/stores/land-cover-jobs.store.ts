import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import type {
  LandCoverEnrichmentJobRow,
  LandCoverJobCounts,
  LandCoverJobStatus,
} from '@/pipeline/stores/land-cover-jobs.types'

export interface CreateLandCoverJobInput {
  event_id: string
  requested_context_version: string
  priority?: number
  max_attempts?: number
}

export async function insertLandCoverJob(
  input: CreateLandCoverJobInput,
): Promise<{ created: boolean; job_id: string | null }> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('land_cover_enrichment_jobs')
    .insert({
      event_id: input.event_id,
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

export async function claimLandCoverJob(
  workerId: string,
  lockTimeoutMinutes: number,
): Promise<LandCoverEnrichmentJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('claim_land_cover_enrichment_job', {
    p_worker_id: workerId,
    p_lock_timeout_minutes: lockTimeoutMinutes,
  })

  if (error) throw new Error(error.message)
  const rows = (data as LandCoverEnrichmentJobRow[] | null) ?? []
  return rows[0] ?? null
}

export async function completeLandCoverJob(jobId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('land_cover_enrichment_jobs')
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

export async function rescheduleLandCoverJob(input: {
  jobId: string
  availableAt: string
  errorCode: string
  errorMessage: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('land_cover_enrichment_jobs')
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

export async function failLandCoverJob(input: {
  jobId: string
  errorCode: string
  errorMessage: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('land_cover_enrichment_jobs')
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

export async function getActiveLandCoverJobForEvent(
  eventId: string,
): Promise<LandCoverEnrichmentJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('land_cover_enrichment_jobs')
    .select('*')
    .eq('event_id', eventId)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as LandCoverEnrichmentJobRow | null) ?? null
}

export async function countLandCoverJobsByStatus(): Promise<LandCoverJobCounts> {
  const supabase = getSupabaseAdmin()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const lockStaleBefore = new Date(Date.now() - 30 * 60 * 1000).toISOString()

  const [pendingRes, processingRes, completedRes, failedRes, staleRes] = await Promise.all([
    supabase
      .from('land_cover_enrichment_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('land_cover_enrichment_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'processing'),
    supabase
      .from('land_cover_enrichment_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', since24h),
    supabase
      .from('land_cover_enrichment_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed'),
    supabase
      .from('land_cover_enrichment_jobs')
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

export async function retryFailedLandCoverJob(eventId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('land_cover_enrichment_jobs')
    .select('id')
    .eq('event_id', eventId)
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data?.id) return false

  const active = await getActiveLandCoverJobForEvent(eventId)
  if (active) return false

  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('land_cover_enrichment_jobs')
    .update({
      status: 'pending',
      attempts: 0,
      available_at: now,
      locked_at: null,
      locked_by: null,
      started_at: null,
      completed_at: null,
      last_error_code: null,
      last_error_message: null,
      updated_at: now,
    })
    .eq('id', data.id)

  if (updateError) throw new Error(updateError.message)
  return true
}

export async function countEventsWithoutLandCoverContext(): Promise<number> {
  const supabase = getSupabaseAdmin()
  const [eventsRes, contextRes] = await Promise.all([
    supabase.from('fire_events').select('id', { count: 'exact', head: true }),
    supabase
      .from('fire_event_land_cover_context')
      .select('event_id', { count: 'exact', head: true }),
  ])

  if (eventsRes.error) throw new Error(eventsRes.error.message)
  if (contextRes.error) throw new Error(contextRes.error.message)

  const total = eventsRes.count ?? 0
  const withContext = contextRes.count ?? 0
  return Math.max(0, total - withContext)
}

export function isActiveJobStatus(status: LandCoverJobStatus): boolean {
  return status === 'pending' || status === 'processing'
}
