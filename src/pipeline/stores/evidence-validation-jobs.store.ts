import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import { VALIDATION_MODEL_VERSION } from '@/modules/evidence/config/fire-evidence-validation.config'

export interface EvidenceValidationJobRow {
  id: string
  submission_id: string
  validation_model_version: string
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
  created_at: string
  updated_at: string
}

export async function enqueueEvidenceValidationJob(input: {
  submissionId: string
  contextSignature?: string
  priority?: number
}): Promise<{ created: boolean; job_id: string | null }> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('evidence_validation_jobs')
    .insert({
      submission_id: input.submissionId,
      validation_model_version: VALIDATION_MODEL_VERSION,
      context_signature: input.contextSignature ?? '',
      status: 'pending',
      priority: input.priority ?? 0,
      max_attempts: 3,
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

export async function claimEvidenceValidationJob(
  workerId: string,
  lockTimeoutMinutes: number,
): Promise<EvidenceValidationJobRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('claim_evidence_validation_job', {
    p_worker_id: workerId,
    p_lock_timeout_minutes: lockTimeoutMinutes,
  })
  if (error) throw new Error(error.message)
  const rows = (data as EvidenceValidationJobRow[] | null) ?? []
  return rows[0] ?? null
}

export async function completeEvidenceValidationJob(jobId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('evidence_validation_jobs')
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

export async function failEvidenceValidationJob(input: {
  jobId: string
  errorCode: string
  errorMessage: string
  rescheduleAt?: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data: job, error: fetchError } = await supabase
    .from('evidence_validation_jobs')
    .select('attempts, max_attempts')
    .eq('id', input.jobId)
    .single()
  if (fetchError) throw new Error(fetchError.message)

  const attempts = (job?.attempts as number) ?? 0
  const maxAttempts = (job?.max_attempts as number) ?? 3
  const terminal = attempts >= maxAttempts

  const { error } = await supabase
    .from('evidence_validation_jobs')
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
