import { randomUUID } from 'node:crypto'

import {
  loadLifecycleWorkerConfig,
  lifecycleRetryBackoffMinutes,
} from '@/pipeline/config/lifecycle-worker.config'
import { runLifecycleEvaluationForEvent } from '@/pipeline/engines/lifecycle/lifecycle-evaluation.engine'
import {
  claimLifecycleJob,
  completeLifecycleJob,
  failLifecycleJob,
  rescheduleLifecycleJob,
} from '@/pipeline/stores/lifecycle-jobs.store'
import type { LifecycleEvaluationJobRow } from '@/pipeline/stores/lifecycle-jobs.types'
import { withTimeout } from '@/pipeline/utils/timeout'

export class EventLifecycleWorker {
  private readonly workerId: string
  private readonly config = loadLifecycleWorkerConfig()

  constructor(workerId?: string) {
    this.workerId = workerId ?? `lifecycle-worker-${randomUUID().slice(0, 8)}`
  }

  private async processJob(
    job: LifecycleEvaluationJobRow,
  ): Promise<'completed' | 'rescheduled' | 'failed'> {
    const started = Date.now()
    try {
      await withTimeout(
        runLifecycleEvaluationForEvent(job.entity_id),
        this.config.jobTimeoutMs,
        'lifecycle_job',
      )
      await completeLifecycleJob(job.id)
      console.log(
        JSON.stringify({
          event: 'lifecycle_worker',
          job_id: job.id,
          event_id: job.entity_id,
          result: 'completed',
          duration_ms: Date.now() - started,
        }),
      )
      return 'completed'
    } catch (err) {
      const message = (err instanceof Error ? err.message : 'lifecycle evaluation failed').slice(
        0,
        240,
      )

      if (job.attempts < job.max_attempts) {
        const availableAt = new Date(
          Date.now() + lifecycleRetryBackoffMinutes(job.attempts) * 60_000,
        ).toISOString()
        await rescheduleLifecycleJob({
          jobId: job.id,
          availableAt,
          errorCode: 'evaluation_failed',
          errorMessage: message,
        })
        return 'rescheduled'
      }

      await failLifecycleJob({
        jobId: job.id,
        errorCode: 'evaluation_failed',
        errorMessage: message,
      })
      return 'failed'
    }
  }

  async processOnce(): Promise<Record<string, number>> {
    const metrics = {
      jobs_claimed: 0,
      jobs_completed: 0,
      jobs_rescheduled: 0,
      jobs_failed: 0,
    }
    const job = await claimLifecycleJob(this.workerId, this.config.lockTimeoutMinutes)
    if (!job) return metrics

    metrics.jobs_claimed = 1
    const result = await this.processJob(job)
    if (result === 'completed') metrics.jobs_completed = 1
    if (result === 'rescheduled') metrics.jobs_rescheduled = 1
    if (result === 'failed') metrics.jobs_failed = 1
    return metrics
  }

  async runUntilEmpty(maxRounds = 1000): Promise<Record<string, number>> {
    const totals = {
      jobs_claimed: 0,
      jobs_completed: 0,
      jobs_rescheduled: 0,
      jobs_failed: 0,
    }
    for (let round = 0; round < maxRounds; round += 1) {
      const metrics = await this.processOnce()
      totals.jobs_claimed += metrics.jobs_claimed
      totals.jobs_completed += metrics.jobs_completed
      totals.jobs_rescheduled += metrics.jobs_rescheduled
      totals.jobs_failed += metrics.jobs_failed
      if (metrics.jobs_claimed === 0) break
    }
    return totals
  }
}
