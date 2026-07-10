import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import type {
  BiodiversityEnrichmentJobRow,
  BiodiversityJobCounts,
} from '@/pipeline/stores/biodiversity-jobs.types'

export interface CreateBiodiversityJobInput {
  entity_type?: string
  entity_id: string
  requested_context_version: string
  priority?: number
  max_attempts?: number
}

export async function insertBiodiversityJob(
  input: CreateBiodiversityJobInput,
): Promise<{ created: boolean; job_id: string | null }> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('biodiversity_enrichment_jobs')
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

export async function claimBiodiversityJob(
  workerId: string,
  lockTimeoutMinutes: number,
): Promise<BiodiversityEnrichmentJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('claim_biodiversity_enrichment_job', {
    p_worker_id: workerId,
    p_lock_timeout_minutes: lockTimeoutMinutes,
  })
  if (error) throw new Error(error.message)
  const rows = (data as BiodiversityEnrichmentJobRow[] | null) ?? []
  return rows[0] ?? null
}

export async function completeBiodiversityJob(jobId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('biodiversity_enrichment_jobs')
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

export async function rescheduleBiodiversityJob(input: {
  jobId: string
  availableAt: string
  errorCode: string
  errorMessage: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('biodiversity_enrichment_jobs')
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

export async function failBiodiversityJob(input: {
  jobId: string
  errorCode: string
  errorMessage: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('biodiversity_enrichment_jobs')
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

export async function getActiveBiodiversityJobForEvent(
  eventId: string,
): Promise<BiodiversityEnrichmentJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('biodiversity_enrichment_jobs')
    .select('*')
    .eq('entity_type', 'fire_event')
    .eq('entity_id', eventId)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as BiodiversityEnrichmentJobRow | null) ?? null
}

export async function countBiodiversityJobs(): Promise<BiodiversityJobCounts> {
  const supabase = getSupabaseAdmin()
  const counts: BiodiversityJobCounts = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  }
  for (const status of Object.keys(counts) as Array<keyof BiodiversityJobCounts>) {
    const { count, error } = await supabase
      .from('biodiversity_enrichment_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', status)
    if (error) throw new Error(error.message)
    counts[status] = count ?? 0
  }
  return counts
}
