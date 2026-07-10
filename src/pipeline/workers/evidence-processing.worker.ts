import {
  claimEvidenceProcessingJob,
  completeEvidenceProcessingJob,
  failEvidenceProcessingJob,
} from '@/pipeline/stores/evidence-processing-jobs.store'
import { runEvidenceProcessing } from '@/pipeline/engines/evidence/evidence-intake-processing.runner'

const WORKER_ID = `evidence-worker-${process.pid}`
const LOCK_TIMEOUT_MINUTES = 30

export class EvidenceProcessingWorker {
  async runOnce(): Promise<boolean> {
    const job = await claimEvidenceProcessingJob(WORKER_ID, LOCK_TIMEOUT_MINUTES)
    if (!job) return false

    try {
      await runEvidenceProcessing(job.submission_id)
      await completeEvidenceProcessingJob(job.id)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'processing_failed'
      await failEvidenceProcessingJob({
        jobId: job.id,
        errorCode: 'processing_failed',
        errorMessage: message,
        rescheduleAt: new Date(Date.now() + 60_000).toISOString(),
      })
      throw err
    }
  }
}
