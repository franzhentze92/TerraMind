import { randomUUID } from 'node:crypto'

import { populationRetryBackoffMinutes, loadPopulationWorkerConfig } from '@/pipeline/config/population-worker.config'
import {
  enrichPopulationForEvent,
  PopulationSourceUnavailableError,
  resolvePopulationRuntime,
} from '@/pipeline/engines/fire/context/population.engine'
import {
  claimPopulationJob,
  completePopulationJob,
  failPopulationJob,
  reschedulePopulationJob,
} from '@/pipeline/stores/population-jobs.store'
import type { PopulationEnrichmentJobRow, PopulationJobErrorCode } from '@/pipeline/stores/population-jobs.types'
import { withTimeout } from '@/pipeline/utils/timeout'

function classifyPopulationJobError(err: unknown): {
  code: PopulationJobErrorCode
  message: string
  retryable: boolean
} {
  if (err instanceof PopulationSourceUnavailableError) {
    return { code: 'source_unavailable', message: err.message, retryable: true }
  }
  if (err instanceof Error && err.message.includes('timeout')) {
    return { code: 'timeout', message: err.message, retryable: true }
  }
  if (err instanceof Error && err.message.includes('geometr')) {
    return { code: 'invalid_geometry', message: err.message, retryable: false }
  }
  return {
    code: 'unknown',
    message: err instanceof Error ? err.message : 'population enrichment failed',
    retryable: true,
  }
}

export class PopulationEnrichmentWorker {
  private readonly workerId: string
  private readonly config = loadPopulationWorkerConfig()

  constructor(workerId?: string) {
    this.workerId = workerId ?? `pop-worker-${randomUUID().slice(0, 8)}`
  }

  private async processJob(
    job: PopulationEnrichmentJobRow,
  ): Promise<'completed' | 'rescheduled' | 'failed'> {
    const started = Date.now()
    try {
      const runtime = await resolvePopulationRuntime()
      if (job.requested_context_version !== runtime.contextVersion) {
        throw new Error('Versión de contexto desactualizada para el job')
      }

      await withTimeout(
        enrichPopulationForEvent(job.entity_id, runtime),
        this.config.jobTimeoutMs,
        'population_job',
      )

      await completePopulationJob(job.id)
      console.log(
        JSON.stringify({
          event: 'population_worker',
          job_id: job.id,
          event_id: job.entity_id,
          result: 'completed',
          duration_ms: Date.now() - started,
        }),
      )
      return 'completed'
    } catch (err) {
      const classified = classifyPopulationJobError(err)
      const safeMessage = classified.message.slice(0, 240)

      if (classified.retryable && job.attempts < job.max_attempts) {
        const backoffMin = populationRetryBackoffMinutes(job.attempts)
        await reschedulePopulationJob({
          jobId: job.id,
          availableAt: new Date(Date.now() + backoffMin * 60_000).toISOString(),
          errorCode: classified.code,
          errorMessage: safeMessage,
        })
        return 'rescheduled'
      }

      await failPopulationJob({
        jobId: job.id,
        errorCode: classified.code,
        errorMessage: safeMessage,
      })
      return 'failed'
    }
  }

  async processOnce(limit = 1) {
    const metrics = {
      jobs_claimed: 0,
      jobs_completed: 0,
      jobs_failed: 0,
      jobs_rescheduled: 0,
      processing_duration_ms: 0,
    }
    const started = Date.now()

    for (let i = 0; i < limit; i += 1) {
      const job = await claimPopulationJob(this.workerId, this.config.lockTimeoutMinutes)
      if (!job) break
      metrics.jobs_claimed += 1
      const outcome = await this.processJob(job)
      if (outcome === 'completed') metrics.jobs_completed += 1
      if (outcome === 'failed') metrics.jobs_failed += 1
      if (outcome === 'rescheduled') metrics.jobs_rescheduled += 1
    }

    metrics.processing_duration_ms = Date.now() - started
    return metrics
  }

  async runUntilEmpty(maxRounds = 1000) {
    const totals = {
      jobs_claimed: 0,
      jobs_completed: 0,
      jobs_failed: 0,
      jobs_rescheduled: 0,
      processing_duration_ms: 0,
    }
    for (let round = 0; round < maxRounds; round += 1) {
      const batch = await this.processOnce(this.config.workerConcurrency)
      totals.jobs_claimed += batch.jobs_claimed
      totals.jobs_completed += batch.jobs_completed
      totals.jobs_failed += batch.jobs_failed
      totals.jobs_rescheduled += batch.jobs_rescheduled
      totals.processing_duration_ms += batch.processing_duration_ms
      if (batch.jobs_claimed === 0) break
    }
    return totals
  }
}
