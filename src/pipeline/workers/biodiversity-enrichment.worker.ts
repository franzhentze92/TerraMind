import { randomUUID } from 'node:crypto'

import {
  biodiversityRetryBackoffMinutes,
  loadBiodiversityWorkerConfig,
} from '@/pipeline/config/biodiversity-worker.config'
import {
  enrichBiodiversityForEvent,
  BiodiversitySourceUnavailableError,
  resolveBiodiversityRuntime,
} from '@/pipeline/engines/fire/context/biodiversity.engine'
import {
  claimBiodiversityJob,
  completeBiodiversityJob,
  failBiodiversityJob,
  rescheduleBiodiversityJob,
} from '@/pipeline/stores/biodiversity-jobs.store'
import type {
  BiodiversityEnrichmentJobRow,
  BiodiversityJobErrorCode,
} from '@/pipeline/stores/biodiversity-jobs.types'
import { withTimeout } from '@/pipeline/utils/timeout'

function classifyBiodiversityJobError(err: unknown): {
  code: BiodiversityJobErrorCode
  message: string
  retryable: boolean
} {
  if (err instanceof BiodiversitySourceUnavailableError) {
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
    message: err instanceof Error ? err.message : 'biodiversity enrichment failed',
    retryable: true,
  }
}

export class BiodiversityEnrichmentWorker {
  private readonly workerId: string
  private readonly config = loadBiodiversityWorkerConfig()

  constructor(workerId?: string) {
    this.workerId = workerId ?? `biodiversity-worker-${randomUUID().slice(0, 8)}`
  }

  private async processJob(
    job: BiodiversityEnrichmentJobRow,
  ): Promise<'completed' | 'rescheduled' | 'failed'> {
    const started = Date.now()
    try {
      const runtime = resolveBiodiversityRuntime()
      if (job.requested_context_version !== runtime.contextVersion) {
        throw new Error('Versión de contexto desactualizada para el job')
      }

      await withTimeout(
        enrichBiodiversityForEvent(job.entity_id, runtime),
        this.config.jobTimeoutMs,
        'biodiversity_job',
      )

      await completeBiodiversityJob(job.id)
      console.log(
        JSON.stringify({
          event: 'biodiversity_worker',
          job_id: job.id,
          event_id: job.entity_id,
          result: 'completed',
          duration_ms: Date.now() - started,
        }),
      )
      return 'completed'
    } catch (err) {
      const classified = classifyBiodiversityJobError(err)
      const safeMessage = classified.message.slice(0, 240)

      if (classified.retryable && job.attempts < job.max_attempts) {
        const backoffMin = biodiversityRetryBackoffMinutes(job.attempts)
        const availableAt = new Date(Date.now() + backoffMin * 60_000).toISOString()
        await rescheduleBiodiversityJob({
          jobId: job.id,
          availableAt,
          errorCode: classified.code,
          errorMessage: safeMessage,
        })
        console.log(
          JSON.stringify({
            event: 'biodiversity_worker',
            job_id: job.id,
            event_id: job.entity_id,
            result: 'rescheduled',
            error_code: classified.code,
            duration_ms: Date.now() - started,
          }),
        )
        return 'rescheduled'
      }

      await failBiodiversityJob({
        jobId: job.id,
        errorCode: classified.code,
        errorMessage: safeMessage,
      })
      console.log(
        JSON.stringify({
          event: 'biodiversity_worker',
          job_id: job.id,
          event_id: job.entity_id,
          result: 'failed',
          error_code: classified.code,
          duration_ms: Date.now() - started,
        }),
      )
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

    const job = await claimBiodiversityJob(this.workerId, this.config.lockTimeoutMinutes)
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
