import { randomUUID } from 'node:crypto'

import {
  findingRetryBackoffMinutes,
  loadFindingWorkerConfig,
} from '@/pipeline/config/finding-worker.config'
import { runFindingEvaluationForEvent } from '@/pipeline/engines/findings/finding-evaluation.engine'
import {
  claimFindingJob,
  completeFindingJob,
  failFindingJob,
  rescheduleFindingJob,
} from '@/pipeline/stores/finding-jobs.store'
import type { FindingEvaluationJobRow } from '@/pipeline/stores/finding-jobs.types'
import { withTimeout } from '@/pipeline/utils/timeout'

export class CompositeFindingWorker {
  private readonly workerId: string
  private readonly config = loadFindingWorkerConfig()

  constructor(workerId?: string) {
    this.workerId = workerId ?? `finding-worker-${randomUUID().slice(0, 8)}`
  }

  private async processJob(
    job: FindingEvaluationJobRow,
  ): Promise<'completed' | 'rescheduled' | 'failed'> {
    const started = Date.now()
    try {
      await withTimeout(
        runFindingEvaluationForEvent(job.entity_id),
        this.config.jobTimeoutMs,
        'finding_job',
      )
      await completeFindingJob(job.id)
      console.log(
        JSON.stringify({
          event: 'finding_worker',
          job_id: job.id,
          event_id: job.entity_id,
          result: 'completed',
          duration_ms: Date.now() - started,
        }),
      )
      return 'completed'
    } catch (err) {
      const message = (err instanceof Error ? err.message : 'finding evaluation failed').slice(
        0,
        240,
      )
      const retryable = !message.includes('Perfil no soportado')

      if (retryable && job.attempts < job.max_attempts) {
        const availableAt = new Date(
          Date.now() + findingRetryBackoffMinutes(job.attempts) * 60_000,
        ).toISOString()
        await rescheduleFindingJob({
          jobId: job.id,
          availableAt,
          errorCode: 'evaluation_failed',
          errorMessage: message,
        })
        return 'rescheduled'
      }

      await failFindingJob({
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
    const job = await claimFindingJob(this.workerId, this.config.lockTimeoutMinutes)
    if (!job) return metrics

    metrics.jobs_claimed = 1
    const result = await this.processJob(job)
    if (result === 'completed') metrics.jobs_completed = 1
    if (result === 'rescheduled') metrics.jobs_rescheduled = 1
    if (result === 'failed') metrics.jobs_failed = 1
    return metrics
  }

  async runUntilEmpty(): Promise<Record<string, number>> {
    const totals = {
      jobs_claimed: 0,
      jobs_completed: 0,
      jobs_rescheduled: 0,
      jobs_failed: 0,
    }
    for (let i = 0; i < this.config.workerConcurrency; i += 1) {
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
