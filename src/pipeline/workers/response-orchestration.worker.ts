import { runResponseAssessmentWithPersistence } from '@/pipeline/engines/response-orchestration/response-orchestration.runner.js'
import { buildResponseOrchestrationInputForIncident } from '@/pipeline/engines/response-orchestration/response-orchestration-input.builder.js'
import {
  claimResponseAssessmentJob,
  updateResponseAssessmentJob,
} from '@/pipeline/stores/response-orchestration.store.js'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client.js'

const RETRY_MINUTES = 5

export class ResponseOrchestrationWorker {
  constructor(private readonly workerId = 'response-orchestration-worker') {}

  async runOnce(): Promise<boolean> {
    const job = await claimResponseAssessmentJob(this.workerId)
    if (!job) return false

    const jobId = String(job.id)
    const incidentId = String(job.incident_id)
    const organizationId = String(job.organization_id)

    try {
      const pending = await getSupabaseAdmin()
        .from('resolution_reevaluation_requests')
        .select('id, status')
        .eq('incident_id', incidentId)
        .neq('status', 'completed')

      if ((pending.data ?? []).length > 0) {
        await updateResponseAssessmentJob(jobId, {
          status: 'waiting_dependencies',
          error_code: null,
        })
        return true
      }

      const built = await buildResponseOrchestrationInputForIncident(incidentId, organizationId)
      if ('ownership_unresolved' in built) {
        await updateResponseAssessmentJob(jobId, {
          status: 'failed_terminal',
          error_code: 'ownership_unresolved',
        })
        return true
      }

      const result = await runResponseAssessmentWithPersistence(built)
      if (!result.assessment) {
        const blocked = result.output.assessmentStatus === 'blocked_inconsistent_snapshot'
        await updateResponseAssessmentJob(jobId, {
          status: blocked ? 'blocked_inconsistent_snapshot' : 'failed_retryable',
          error_code: result.output.assessmentStatus,
          next_retry_at: blocked
            ? null
            : new Date(Date.now() + RETRY_MINUTES * 60_000).toISOString(),
          input_signature: result.output.inputSignature,
        })
        return true
      }

      await updateResponseAssessmentJob(jobId, {
        status: 'completed',
        result_assessment_id: String(result.assessment.id),
        input_signature: result.output.inputSignature,
        error_code: null,
      })
      return true
    } catch (err) {
      const attempts = Number(job.attempts ?? 1)
      const terminal = attempts >= Number(job.max_attempts ?? 5)
      await updateResponseAssessmentJob(jobId, {
        status: terminal ? 'failed_terminal' : 'failed_retryable',
        error_code: err instanceof Error ? err.message : 'unknown_error',
        next_retry_at: terminal
          ? null
          : new Date(Date.now() + RETRY_MINUTES * 60_000).toISOString(),
      })
      return true
    }
  }
}
