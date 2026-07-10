import {
  claimEvidenceValidationJob,
  completeEvidenceValidationJob,
  failEvidenceValidationJob,
} from '@/pipeline/stores/evidence-validation-jobs.store'
import { runEvidenceValidation } from '@/pipeline/engines/evidence/evidence-validation.runner'

const WORKER_ID = `evidence-validation-worker-${process.pid}`
const LOCK_TIMEOUT_MINUTES = 30

export class EvidenceValidationWorker {
  async runOnce(): Promise<boolean> {
    const job = await claimEvidenceValidationJob(WORKER_ID, LOCK_TIMEOUT_MINUTES)
    if (!job) return false

    try {
      await runEvidenceValidation(job.submission_id)
      await completeEvidenceValidationJob(job.id)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'validation_failed'
      await failEvidenceValidationJob({
        jobId: job.id,
        errorCode: 'validation_failed',
        errorMessage: message,
        rescheduleAt: new Date(Date.now() + 60_000).toISOString(),
      })
      throw err
    }
  }
}
