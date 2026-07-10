import {
  claimVerificationResolutionJob,
  completeVerificationResolutionJob,
  failVerificationResolutionJob,
} from '@/pipeline/stores/verification-resolution-jobs.store'
import {
  processVerificationResolutionCandidate,
  runVerificationResolutionJob,
} from '@/pipeline/engines/verification/verification-resolution.runner'

const WORKER_ID = `verification-resolution-worker-${process.pid}`
const LOCK_TIMEOUT_MINUTES = 30

export class VerificationResolutionWorker {
  async runOnce(): Promise<boolean> {
    const candidateProcessed = await processVerificationResolutionCandidate()
    if (candidateProcessed) return true

    const job = await claimVerificationResolutionJob(WORKER_ID, LOCK_TIMEOUT_MINUTES)
    if (!job) return false

    try {
      await runVerificationResolutionJob(job.plan_id)
      await completeVerificationResolutionJob(job.id)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'resolution_failed'
      await failVerificationResolutionJob({
        jobId: job.id,
        errorCode: 'resolution_failed',
        errorMessage: message,
        rescheduleAt: new Date(Date.now() + 60_000).toISOString(),
      })
      throw err
    }
  }
}
