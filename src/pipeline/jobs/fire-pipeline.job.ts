import { runFireIngestion, type IngestResult } from '@/pipeline/engines/fire/ingest.engine'
import { runFireGeographyClassification } from '@/pipeline/engines/fire/geography.engine'
import { runClusterPipeline } from '@/pipeline/engines/fire/cluster.pipeline'
import {
  PIPELINE_RETRY,
  PIPELINE_TIMEOUTS_MS,
  type FirePipelineRunStatus,
  type FirePipelineTriggerType,
} from '@/pipeline/config/fire-pipeline.config'
import {
  completePipelineRun,
  countNationalDetectionsPendingCluster,
  createPipelineRun,
  createSkippedPipelineRun,
  hasRecentRetryParent,
  PipelineConcurrencyError,
  refreshEventStatusesDetailed,
  releasePipelineLock,
  tryAcquirePipelineLock,
  type PipelineStageRecord,
} from '@/pipeline/stores/fire-pipeline.store'
import { StageTimeoutError, withTimeout } from '@/pipeline/utils/timeout'
import { isTransientError, withRetry } from '@/pipeline/utils/retry'
import type { GeographyClassifyMetrics } from '@/pipeline/engines/fire/geography.engine'
import type { ClusterDryRunResult } from '@/pipeline/stores/fire-event.types'

export interface FirePipelineRunOptions {
  triggerType: FirePipelineTriggerType
  retryOf?: string
}

export interface FirePipelineRunResult {
  pipelineRunId: string
  status: FirePipelineRunStatus
  durationMs: number
  stages: Record<string, PipelineStageRecord>
  metrics: Record<string, unknown>
  ingestionRunId: string | null
  errorMessage: string | null
  skippedReason?: string
}

let pipelineRunning = false

export function isFirePipelineRunning(): boolean {
  return pipelineRunning
}

function logStage(
  pipelineRunId: string,
  stage: string,
  payload: Record<string, unknown>,
): void {
  console.log(
    JSON.stringify({
      event: 'fire_pipeline_stage',
      pipeline_run_id: pipelineRunId,
      stage,
      ...payload,
    }),
  )
}

function resolvePipelineStatus(
  stages: Record<string, PipelineStageRecord>,
): FirePipelineRunStatus {
  const values = Object.values(stages)
  if (values.some((s) => s.status === 'failed')) return 'failed'
  if (values.some((s) => s.status === 'partial')) return 'partial'
  return 'success'
}

function ingestionAllowsDownstream(result: IngestResult): boolean {
  if (result.status === 'failed') return false
  if (result.status === 'success') return true
  return result.rowsValid > 0 || result.rowsInserted > 0 || result.rowsUpdated > 0
}

async function runIngestionStage(
  pipelineRunId: string,
  releaseLockDuringBackoff: () => Promise<void>,
  reacquireLock: () => Promise<boolean>,
): Promise<{ record: PipelineStageRecord; result: IngestResult }> {
  const start = Date.now()
  try {
    const result = await withTimeout(
      withRetry(
        async (attempt) => {
          logStage(pipelineRunId, 'ingestion', { status: 'running', retry_attempt: attempt })
          return runFireIngestion({ dryRun: false })
        },
        {
          shouldRetry: isTransientError,
          onBackoff: async (attempt, waitMs) => {
            logStage(pipelineRunId, 'ingestion', {
              status: 'retry_backoff',
              retry_attempt: attempt,
              wait_ms: waitMs,
            })
            await releaseLockDuringBackoff()
            await new Promise((r) => setTimeout(r, waitMs))
            const acquired = await reacquireLock()
            if (!acquired) {
              throw new Error('concurrent_run_during_retry')
            }
          },
        },
      ),
      PIPELINE_TIMEOUTS_MS.ingestionTotal,
      'ingestion',
    )

    const record: PipelineStageRecord = {
      status: result.status === 'failed' ? 'failed' : result.status === 'partial' ? 'partial' : 'success',
      duration_ms: Date.now() - start,
      metrics: {
        run_id: result.runId,
        rows_received: result.rowsReceived,
        rows_valid: result.rowsValid,
        rows_inserted: result.rowsInserted,
        rows_updated: result.rowsUpdated,
        rows_duplicated: result.rowsDuplicated,
        sources_failed: result.sources.filter((s) => s.error).length,
      },
      error: result.errors.length ? result.errors.join('; ') : undefined,
    }
    return { record, result }
  } catch (err) {
    const record: PipelineStageRecord = {
      status: 'failed',
      duration_ms: Date.now() - start,
      error: err instanceof Error ? err.message : 'Error en ingesta',
      error_code: err instanceof StageTimeoutError ? 'timeout' : 'ingestion_failed',
    }
    throw Object.assign(err instanceof Error ? err : new Error('ingestion failed'), { stageRecord: record })
  }
}

function recordSkippedRun(
  options: FirePipelineRunOptions,
  reason: string,
): Promise<FirePipelineRunResult> {
  return (async () => {
    const skippedId = await createSkippedPipelineRun({
      trigger_type: options.triggerType,
      retry_of: options.retryOf,
      reason,
    })

    return {
      pipelineRunId: skippedId,
      status: 'skipped',
      durationMs: 0,
      stages: {},
      metrics: { reason },
      ingestionRunId: null,
      errorMessage: reason,
      skippedReason: reason,
    }
  })()
}

export async function runFirePipeline(
  options: FirePipelineRunOptions,
): Promise<FirePipelineRunResult> {
  if (pipelineRunning) {
    return recordSkippedRun(options, 'concurrent_run_in_process')
  }

  if (options.retryOf) {
    const since = new Date(Date.now() - PIPELINE_RETRY.minRetryIntervalMs).toISOString()
    if (await hasRecentRetryParent(options.retryOf, since)) {
      return recordSkippedRun({ ...options, triggerType: 'retry' }, 'retry_rate_limited')
    }
  }

  const lockAcquired = await tryAcquirePipelineLock()
  if (!lockAcquired) {
    return recordSkippedRun(options, 'concurrent_run')
  }

  pipelineRunning = true
  const started = Date.now()
  let pipelineRunId: string

  try {
    pipelineRunId = await createPipelineRun({
      trigger_type: options.triggerType,
      retry_of: options.retryOf,
    })
  } catch (err) {
    pipelineRunning = false
    await releasePipelineLock()
    if (err instanceof PipelineConcurrencyError) {
      return recordSkippedRun(options, 'concurrent_run')
    }
    throw err
  }

  const stages: Record<string, PipelineStageRecord> = {}
  let ingestionRunId: string | null = null
  let errorMessage: string | null = null
  let ingestResult: IngestResult | null = null

  const releaseLockDuringBackoff = async () => {
    await releasePipelineLock()
  }
  const reacquireLock = async () => tryAcquirePipelineLock()

  try {
    try {
      await withTimeout(
        (async () => {
          try {
            const ingestion = await runIngestionStage(
              pipelineRunId,
              releaseLockDuringBackoff,
              reacquireLock,
            )
            stages.ingestion = ingestion.record
            ingestResult = ingestion.result
            ingestionRunId = ingestion.result.runId
          } catch (err) {
            const stageRecord = (err as { stageRecord?: PipelineStageRecord }).stageRecord
            stages.ingestion =
              stageRecord ??
              ({
                status: 'failed',
                duration_ms: 0,
                error: err instanceof Error ? err.message : 'ingestion failed',
              } satisfies PipelineStageRecord)
            throw err
          }

          const canContinue = ingestResult && ingestionAllowsDownstream(ingestResult)

          if (canContinue) {
            const geoStart = Date.now()
            try {
              const geo = await withTimeout(
                runFireGeographyClassification({ limit: 10000, force: false }),
                PIPELINE_TIMEOUTS_MS.geography,
                'geography',
              )
              stages.geography = {
                status: 'success',
                duration_ms: Date.now() - geoStart,
                metrics: geo as unknown as Record<string, unknown>,
              }
            } catch (err) {
              stages.geography = {
                status: 'failed',
                duration_ms: Date.now() - geoStart,
                error: err instanceof Error ? err.message : 'geography failed',
                error_code: err instanceof StageTimeoutError ? 'timeout' : 'geography_failed',
              }
              throw err
            }

            const nationalCount = await countNationalDetectionsPendingCluster()
            if (nationalCount > 0) {
              const clusterStart = Date.now()
              try {
                const cluster = await withTimeout(
                  runClusterPipeline({ dryRun: false, force: false, limit: 10000 }),
                  PIPELINE_TIMEOUTS_MS.clustering,
                  'clustering',
                )
                stages.clustering = {
                  status: 'success',
                  duration_ms: Date.now() - clusterStart,
                  metrics: cluster.metrics as unknown as Record<string, unknown>,
                }
              } catch (err) {
                stages.clustering = {
                  status: 'failed',
                  duration_ms: Date.now() - clusterStart,
                  error: err instanceof Error ? err.message : 'clustering failed',
                  error_code: err instanceof StageTimeoutError ? 'timeout' : 'clustering_failed',
                }
                throw err
              }
            } else {
              stages.clustering = {
                status: 'skipped',
                duration_ms: 0,
                metrics: { reason: 'no_national_detections' },
              }
            }
          } else {
            stages.geography = {
              status: 'skipped',
              duration_ms: 0,
              metrics: { reason: 'ingestion_failed_or_empty' },
            }
            stages.clustering = {
              status: 'skipped',
              duration_ms: 0,
              metrics: { reason: 'ingestion_failed_or_empty' },
            }
          }

          const statusStart = Date.now()
          try {
            const statusMetrics = await withTimeout(
              refreshEventStatusesDetailed(),
              PIPELINE_TIMEOUTS_MS.geography,
              'status_refresh',
            )
            stages.status_refresh = {
              status: 'success',
              duration_ms: Date.now() - statusStart,
              metrics: statusMetrics as unknown as Record<string, unknown>,
            }
          } catch (err) {
            stages.status_refresh = {
              status: 'failed',
              duration_ms: Date.now() - statusStart,
              error: err instanceof Error ? err.message : 'status refresh failed',
              error_code: err instanceof StageTimeoutError ? 'timeout' : 'status_refresh_failed',
            }
            throw err
          }
        })(),
        PIPELINE_TIMEOUTS_MS.pipelineTotal,
        'pipeline',
      )
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'pipeline failed'
      logStage(pipelineRunId, 'pipeline', {
        status: 'failed',
        error: errorMessage,
        error_code: err instanceof StageTimeoutError ? 'timeout' : 'pipeline_failed',
      })
    }

    const durationMs = Date.now() - started
    const finalStatus = computeFinalStatus(stages, errorMessage)

    const metrics: Record<string, unknown> = {
      ingestion_run_id: ingestionRunId,
      national_detections: await countNationalDetectionsPendingCluster().catch(() => null),
    }

    await completePipelineRun(pipelineRunId, {
      status: finalStatus,
      duration_ms: durationMs,
      ingestion_run_id: ingestionRunId,
      stages,
      metrics,
      error_message: errorMessage,
    })

    logStage(pipelineRunId, 'pipeline', {
      status: finalStatus,
      duration_ms: durationMs,
    })

    return {
      pipelineRunId,
      status: finalStatus,
      durationMs,
      stages,
      metrics,
      ingestionRunId,
      errorMessage,
    }
  } finally {
    pipelineRunning = false
    await releasePipelineLock()
  }
}

function computeFinalStatus(
  stages: Record<string, PipelineStageRecord>,
  errorMessage: string | null,
): FirePipelineRunStatus {
  if (stages.ingestion?.status === 'failed') return 'failed'
  if (errorMessage && Object.values(stages).some((s) => s.status === 'failed')) return 'failed'
  if (stages.ingestion?.status === 'partial') return 'partial'
  if (errorMessage) return 'failed'
  return resolvePipelineStatus(stages)
}

// Re-export types used by health service
export type { GeographyClassifyMetrics, ClusterDryRunResult }
