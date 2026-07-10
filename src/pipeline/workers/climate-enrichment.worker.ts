import { randomUUID } from 'node:crypto'

import { climateRetryBackoffMinutes, loadClimateWorkerConfig } from '@/pipeline/config/climate-worker.config'
import {
  enrichClimateForEvent,
  ClimateSourceUnavailableError,
  resolveClimateRuntime,
} from '@/pipeline/engines/fire/context/climate.engine'
import {
  claimClimateJob,
  completeClimateJob,
  failClimateJob,
  rescheduleClimateJob,
} from '@/pipeline/stores/climate-jobs.store'
import type { ClimateEnrichmentJobRow, ClimateJobErrorCode } from '@/pipeline/stores/climate-jobs.types'
import { withTimeout } from '@/pipeline/utils/timeout'

function classifyClimateJobError(err: unknown): {
  code: ClimateJobErrorCode
  message: string
  retryable: boolean
} {
  if (err instanceof ClimateSourceUnavailableError) {
    return { code: 'source_unavailable', message: err.message, retryable: true }
  }
  if (err instanceof Error && err.message.includes('timeout')) {
    return { code: 'timeout', message: err.message, retryable: true }
  }
  if (err instanceof Error && err.message.includes('Versión de contexto')) {
    return { code: 'version_mismatch', message: err.message, retryable: false }
  }
  if (err instanceof Error && err.message.includes('centroide')) {
    return { code: 'invalid_geometry', message: err.message, retryable: false }
  }
  return {
    code: 'unknown',
    message: err instanceof Error ? err.message : 'climate enrichment failed',
    retryable: true,
  }
}

export class ClimateEnrichmentWorker {
  private readonly workerId: string
  private readonly config = loadClimateWorkerConfig()

  constructor(workerId?: string) {
    this.workerId = workerId ?? `climate-worker-${randomUUID().slice(0, 8)}`
  }

  private async processJob(
    job: ClimateEnrichmentJobRow,
  ): Promise<'completed' | 'rescheduled' | 'failed'> {
    const started = Date.now()
    try {
      const runtime = resolveClimateRuntime()
      if (job.requested_context_version !== runtime.contextVersion) {
        throw new Error('Versión de contexto desactualizada para el job')
      }

      await withTimeout(
        enrichClimateForEvent(job.entity_id, runtime),
        this.config.jobTimeoutMs,
        'climate_job',
      )

      await completeClimateJob(job.id)
      console.log(
        JSON.stringify({
          event: 'climate_worker',
          job_id: job.id,
          event_id: job.entity_id,
          result: 'completed',
          duration_ms: Date.now() - started,
        }),
      )
      return 'completed'
    } catch (err) {
      const classified = classifyClimateJobError(err)
      const safeMessage = classified.message.slice(0, 240)

      if (classified.retryable && job.attempts < job.max_attempts) {
        const backoffMin = climateRetryBackoffMinutes(job.attempts)
        await rescheduleClimateJob({
          jobId: job.id,
          availableAt: new Date(Date.now() + backoffMin * 60_000).toISOString(),
          errorCode: classified.code,
          errorMessage: safeMessage,
        })
        return 'rescheduled'
      }

      await failClimateJob({
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
      const job = await claimClimateJob(this.workerId, this.config.lockTimeoutMinutes)
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
