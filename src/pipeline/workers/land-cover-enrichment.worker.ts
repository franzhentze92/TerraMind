import { randomUUID } from 'node:crypto'
import {
  loadLandCoverWorkerConfig,
  retryBackoffMinutes,
} from '@/pipeline/config/land-cover-worker.config'
import { classifyLandCoverJobError } from '@/pipeline/engines/fire/context/land-cover-errors'
import {
  enrichLandCoverForEvent,
  resolveLandCoverRuntime,
  type LandCoverRuntimeContext,
} from '@/pipeline/engines/fire/context/land-cover.engine'
import {
  claimLandCoverJob,
  completeLandCoverJob,
  failLandCoverJob,
  rescheduleLandCoverJob,
} from '@/pipeline/stores/land-cover-jobs.store'
import type { LandCoverEnrichmentJobRow } from '@/pipeline/stores/land-cover-jobs.types'
import { withTimeout } from '@/pipeline/utils/timeout'

export interface LandCoverWorkerRunMetrics {
  jobs_claimed: number
  jobs_completed: number
  jobs_failed: number
  jobs_rescheduled: number
  processing_duration_ms: number
  gdal_duration_ms: number
  persistence_included: boolean
}

function logJobEvent(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ event: 'land_cover_worker', ...payload }))
}

export class LandCoverEnrichmentWorker {
  private readonly workerId: string
  private readonly config = loadLandCoverWorkerConfig()
  private runtime: LandCoverRuntimeContext | null = null

  constructor(workerId?: string) {
    this.workerId = workerId ?? `lc-worker-${randomUUID().slice(0, 8)}`
  }

  private async getRuntime(): Promise<LandCoverRuntimeContext> {
    if (!this.runtime) {
      this.runtime = await resolveLandCoverRuntime()
    }
    return this.runtime
  }

  private async processJob(job: LandCoverEnrichmentJobRow): Promise<'completed' | 'rescheduled' | 'failed'> {
    const gdalStarted = Date.now()
    try {
      const runtime = await this.getRuntime()
      if (job.requested_context_version !== runtime.contextVersion) {
        throw new Error('Versión de contexto desactualizada para el job')
      }

      await withTimeout(
        enrichLandCoverForEvent(job.event_id, runtime),
        this.config.jobTimeoutMs,
        'land_cover_job',
      )

      await completeLandCoverJob(job.id)
      logJobEvent({
        job_id: job.id,
        event_id: job.event_id,
        attempt: job.attempts,
        duration_ms: Date.now() - gdalStarted,
        context_version: job.requested_context_version,
        result: 'completed',
      })
      return 'completed'
    } catch (err) {
      const classified = classifyLandCoverJobError(err)
      const safeMessage = classified.message.slice(0, 240)

      if (classified.retryable && job.attempts < job.max_attempts) {
        const backoffMin = retryBackoffMinutes(job.attempts)
        const availableAt = new Date(Date.now() + backoffMin * 60_000).toISOString()
        await rescheduleLandCoverJob({
          jobId: job.id,
          availableAt,
          errorCode: classified.code,
          errorMessage: safeMessage,
        })
        logJobEvent({
          job_id: job.id,
          event_id: job.event_id,
          attempt: job.attempts,
          duration_ms: Date.now() - gdalStarted,
          context_version: job.requested_context_version,
          result: 'rescheduled',
          error_code: classified.code,
          retry_in_minutes: backoffMin,
        })
        return 'rescheduled'
      }

      await failLandCoverJob({
        jobId: job.id,
        errorCode: classified.code,
        errorMessage: safeMessage,
      })
      logJobEvent({
        job_id: job.id,
        event_id: job.event_id,
        attempt: job.attempts,
        duration_ms: Date.now() - gdalStarted,
        context_version: job.requested_context_version,
        result: 'failed',
        error_code: classified.code,
      })
      return 'failed'
    }
  }

  async processOnce(limit = 1): Promise<LandCoverWorkerRunMetrics> {
    const started = Date.now()
    const metrics: LandCoverWorkerRunMetrics = {
      jobs_claimed: 0,
      jobs_completed: 0,
      jobs_failed: 0,
      jobs_rescheduled: 0,
      processing_duration_ms: 0,
      gdal_duration_ms: 0,
      persistence_included: true,
    }

    for (let i = 0; i < limit; i += 1) {
      const job = await claimLandCoverJob(this.workerId, this.config.lockTimeoutMinutes)
      if (!job) break

      metrics.jobs_claimed += 1
      const gdalStart = Date.now()
      const outcome = await this.processJob(job)
      metrics.gdal_duration_ms += Date.now() - gdalStart

      if (outcome === 'completed') metrics.jobs_completed += 1
      if (outcome === 'failed') metrics.jobs_failed += 1
      if (outcome === 'rescheduled') metrics.jobs_rescheduled += 1
    }

    metrics.processing_duration_ms = Date.now() - started
    return metrics
  }

  async runUntilEmpty(maxRounds = 1000): Promise<LandCoverWorkerRunMetrics> {
    const totals: LandCoverWorkerRunMetrics = {
      jobs_claimed: 0,
      jobs_completed: 0,
      jobs_failed: 0,
      jobs_rescheduled: 0,
      processing_duration_ms: 0,
      gdal_duration_ms: 0,
      persistence_included: true,
    }

    for (let round = 0; round < maxRounds; round += 1) {
      const batch = await this.processOnce(this.config.workerConcurrency)
      totals.jobs_claimed += batch.jobs_claimed
      totals.jobs_completed += batch.jobs_completed
      totals.jobs_failed += batch.jobs_failed
      totals.jobs_rescheduled += batch.jobs_rescheduled
      totals.processing_duration_ms += batch.processing_duration_ms
      totals.gdal_duration_ms += batch.gdal_duration_ms
      if (batch.jobs_claimed === 0) break
    }

    return totals
  }
}

export async function getLandCoverEnrichmentHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unavailable'
  raster_available: boolean
  queue_pending: number
  queue_processing: number
  queue_failed: number
  stale_locks: number
  oldest_pending_age_minutes: number | null
}> {
  const { countLandCoverJobsByStatus } = await import('@/pipeline/stores/land-cover-jobs.store')
  const { createLandCoverService } = await import('@/modules/territory/land-cover/land-cover.service')

  const [counts, raster] = await Promise.all([
    countLandCoverJobsByStatus(),
    createLandCoverService().getSourceStatus(),
  ])

  if (!raster.available) {
    return {
      status: 'unavailable',
      raster_available: false,
      queue_pending: counts.pending,
      queue_processing: counts.processing,
      queue_failed: counts.failed,
      stale_locks: counts.stale_locks,
      oldest_pending_age_minutes: null,
    }
  }

  let status: 'healthy' | 'degraded' | 'unavailable' = 'healthy'
  if (counts.failed > 0 || counts.stale_locks > 0 || counts.pending > 50) {
    status = 'degraded'
  }

  return {
    status,
    raster_available: true,
    queue_pending: counts.pending,
    queue_processing: counts.processing,
    queue_failed: counts.failed,
    stale_locks: counts.stale_locks,
    oldest_pending_age_minutes: null,
  }
}
