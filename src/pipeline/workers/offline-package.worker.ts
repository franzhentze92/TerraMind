import {
  claimOfflinePackageJob,
  failOfflinePackageJob,
} from '@/pipeline/stores/offline-package-jobs.store'
import { runOfflinePackageJob } from '@/pipeline/engines/field-operations/offline-package.runner'

const WORKER_ID = `offline-package-worker-${process.pid}`
const LOCK_TIMEOUT_MINUTES = 30

export class OfflinePackageWorker {
  async runOnce(): Promise<boolean> {
    const job = await claimOfflinePackageJob(WORKER_ID, LOCK_TIMEOUT_MINUTES)
    if (!job) return false

    try {
      await runOfflinePackageJob(job)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'offline_package_failed'
      await failOfflinePackageJob({
        jobId: job.id,
        errorCode: 'generation_failed',
        errorMessage: message,
        rescheduleAt: new Date(Date.now() + 60_000).toISOString(),
      })
      throw err
    }
  }
}
