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
import {
  ProtectedAreasLayerUnavailableError,
  runProtectedAreasEnrichment,
} from '@/pipeline/engines/fire/context/protected-areas.engine'

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
            stages.protected_area_enrichment = {
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

          const enrichStart = Date.now()
          try {
            const enrich = await withTimeout(
              runProtectedAreasEnrichment({ limit: 10000, force: false }),
              PIPELINE_TIMEOUTS_MS.protectedAreaEnrichment,
              'protected_area_enrichment',
            )
            stages.protected_area_enrichment = {
              status: enrich.events_failed > 0 ? 'partial' : 'success',
              duration_ms: Date.now() - enrichStart,
              metrics: {
                events_considered: enrich.events_considered,
                events_enriched: enrich.events_enriched,
                events_unchanged: enrich.events_unchanged,
                events_failed: enrich.events_failed,
                inside_protected_area_count: enrich.inside_protected_area_count,
                context_version: enrich.context_version,
              },
            }
          } catch (err) {
            const isUnavailable = err instanceof ProtectedAreasLayerUnavailableError
            stages.protected_area_enrichment = {
              status: isUnavailable ? 'partial' : 'failed',
              duration_ms: Date.now() - enrichStart,
              error: err instanceof Error ? err.message : 'protected area enrichment failed',
              error_code: err instanceof StageTimeoutError
                ? 'timeout'
                : isUnavailable
                  ? 'layer_unavailable'
                  : 'protected_area_enrichment_failed',
            }
            if (!isUnavailable) {
              throw err
            }
          }

          const landCoverEnqueueStart = Date.now()
          try {
            const { enqueueLandCoverJobs } = await import(
              '@/pipeline/engines/fire/context/land-cover-jobs.engine'
            )
            const landCoverEnqueue = await enqueueLandCoverJobs({ limit: 10000, force: false })
            stages.land_cover_enqueue = {
              status: 'success',
              duration_ms: Date.now() - landCoverEnqueueStart,
              metrics: {
                jobs_created: landCoverEnqueue.jobs_created,
                land_cover_jobs_created: landCoverEnqueue.jobs_created,
                jobs_skipped: landCoverEnqueue.jobs_skipped,
                events_unchanged: landCoverEnqueue.events_unchanged,
                context_version: landCoverEnqueue.context_version,
              },
            }
          } catch (err) {
            stages.land_cover_enqueue = {
              status: 'partial',
              duration_ms: Date.now() - landCoverEnqueueStart,
              error: err instanceof Error ? err.message : 'land cover enqueue failed',
              error_code: 'land_cover_enqueue_failed',
              metrics: { land_cover_jobs_created: 0 },
            }
            logStage(pipelineRunId, 'land_cover_enqueue', {
              status: 'warning',
              error: err instanceof Error ? err.message : 'enqueue failed',
            })
          }

          const populationEnqueueStart = Date.now()
          try {
            const { enqueuePopulationJobs } = await import(
              '@/pipeline/engines/fire/context/population-jobs.engine'
            )
            const populationEnqueue = await enqueuePopulationJobs({ limit: 10000, force: false })
            stages.population_enqueue = {
              status: 'success',
              duration_ms: Date.now() - populationEnqueueStart,
              metrics: {
                jobs_created: populationEnqueue.jobs_created,
                population_jobs_created: populationEnqueue.jobs_created,
                jobs_skipped: populationEnqueue.jobs_skipped,
                events_unchanged: populationEnqueue.events_unchanged,
                context_version: populationEnqueue.context_version,
              },
            }
          } catch (err) {
            stages.population_enqueue = {
              status: 'partial',
              duration_ms: Date.now() - populationEnqueueStart,
              error: err instanceof Error ? err.message : 'population enqueue failed',
              error_code: 'population_enqueue_failed',
              metrics: { population_jobs_created: 0 },
            }
            logStage(pipelineRunId, 'population_enqueue', {
              status: 'warning',
              error: err instanceof Error ? err.message : 'enqueue failed',
            })
          }

          const climateEnqueueStart = Date.now()
          try {
            const { enqueueClimateJobs } = await import(
              '@/pipeline/engines/fire/context/climate-jobs.engine'
            )
            const climateEnqueue = await enqueueClimateJobs({ limit: 10000, force: false })
            stages.climate_enqueue = {
              status: 'success',
              duration_ms: Date.now() - climateEnqueueStart,
              metrics: {
                jobs_created: climateEnqueue.jobs_created,
                climate_jobs_created: climateEnqueue.jobs_created,
                jobs_skipped: climateEnqueue.jobs_skipped,
                events_unchanged: climateEnqueue.events_unchanged,
                context_version: climateEnqueue.context_version,
              },
            }
          } catch (err) {
            stages.climate_enqueue = {
              status: 'partial',
              duration_ms: Date.now() - climateEnqueueStart,
              error: err instanceof Error ? err.message : 'climate enqueue failed',
              error_code: 'climate_enqueue_failed',
              metrics: { climate_jobs_created: 0 },
            }
            logStage(pipelineRunId, 'climate_enqueue', {
              status: 'warning',
              error: err instanceof Error ? err.message : 'enqueue failed',
            })
          }

          const biodiversityEnqueueStart = Date.now()
          try {
            const { enqueueBiodiversityJobs } = await import(
              '@/pipeline/engines/fire/context/biodiversity-jobs.engine'
            )
            const biodiversityEnqueue = await enqueueBiodiversityJobs({ limit: 10000, force: false })
            stages.biodiversity_enqueue = {
              status: 'success',
              duration_ms: Date.now() - biodiversityEnqueueStart,
              metrics: {
                jobs_created: biodiversityEnqueue.jobs_created,
                biodiversity_jobs_created: biodiversityEnqueue.jobs_created,
                jobs_skipped: biodiversityEnqueue.jobs_skipped,
                events_unchanged: biodiversityEnqueue.events_unchanged,
                context_version: biodiversityEnqueue.context_version,
              },
            }
          } catch (err) {
            stages.biodiversity_enqueue = {
              status: 'partial',
              duration_ms: Date.now() - biodiversityEnqueueStart,
              error: err instanceof Error ? err.message : 'biodiversity enqueue failed',
              error_code: 'biodiversity_enqueue_failed',
              metrics: { biodiversity_jobs_created: 0 },
            }
            logStage(pipelineRunId, 'biodiversity_enqueue', {
              status: 'warning',
              error: err instanceof Error ? err.message : 'enqueue failed',
            })
          }

          const lifecycleEnqueueStart = Date.now()
          try {
            const { enqueueLifecycleJobs } = await import(
              '@/pipeline/engines/lifecycle/lifecycle-jobs.engine'
            )
            const lifecycleEnqueue = await enqueueLifecycleJobs({ limit: 10000, force: false })
            stages.lifecycle_enqueue = {
              status: 'success',
              duration_ms: Date.now() - lifecycleEnqueueStart,
              metrics: {
                jobs_created: lifecycleEnqueue.jobs_created,
                lifecycle_jobs_created: lifecycleEnqueue.jobs_created,
                jobs_skipped: lifecycleEnqueue.jobs_skipped,
                lifecycle_model_version: lifecycleEnqueue.lifecycle_model_version,
              },
            }
          } catch (err) {
            stages.lifecycle_enqueue = {
              status: 'partial',
              duration_ms: Date.now() - lifecycleEnqueueStart,
              error: err instanceof Error ? err.message : 'lifecycle enqueue failed',
              error_code: 'lifecycle_enqueue_failed',
              metrics: { lifecycle_jobs_created: 0 },
            }
            logStage(pipelineRunId, 'lifecycle_enqueue', {
              status: 'warning',
              error: err instanceof Error ? err.message : 'enqueue failed',
            })
          }

          const incidentEnqueueStart = Date.now()
          try {
            const { enqueueIncidentCorrelationJobs } = await import(
              '@/pipeline/engines/incidents/incident-correlation-jobs.engine'
            )
            const incidentEnqueue = await enqueueIncidentCorrelationJobs({
              limit: 10000,
              force: false,
            })
            stages.incident_enqueue = {
              status: 'success',
              duration_ms: Date.now() - incidentEnqueueStart,
              metrics: {
                jobs_created: incidentEnqueue.jobs_created,
                incident_jobs_created: incidentEnqueue.jobs_created,
                jobs_skipped: incidentEnqueue.jobs_skipped,
                correlation_model_version: incidentEnqueue.correlation_model_version,
              },
            }
          } catch (err) {
            stages.incident_enqueue = {
              status: 'partial',
              duration_ms: Date.now() - incidentEnqueueStart,
              error: err instanceof Error ? err.message : 'incident enqueue failed',
              error_code: 'incident_enqueue_failed',
              metrics: { incident_jobs_created: 0 },
            }
            logStage(pipelineRunId, 'incident_enqueue', {
              status: 'warning',
              error: err instanceof Error ? err.message : 'enqueue failed',
            })
          }

          const verificationEnqueueStart = Date.now()
          try {
            const { enqueueVerificationPlanJobs } = await import(
              '@/pipeline/engines/verification/verification-plan-jobs.engine'
            )
            const verificationEnqueue = await enqueueVerificationPlanJobs({
              limit: 10000,
              force: false,
            })
            stages.verification_plan_enqueue = {
              status: 'success',
              duration_ms: Date.now() - verificationEnqueueStart,
              metrics: {
                jobs_created: verificationEnqueue.jobs_created,
                verification_jobs_created: verificationEnqueue.jobs_created,
                jobs_skipped: verificationEnqueue.jobs_skipped,
                verification_model_version: verificationEnqueue.verification_model_version,
              },
            }
          } catch (err) {
            stages.verification_plan_enqueue = {
              status: 'partial',
              duration_ms: Date.now() - verificationEnqueueStart,
              error: err instanceof Error ? err.message : 'verification enqueue failed',
              error_code: 'verification_plan_enqueue_failed',
              metrics: { verification_jobs_created: 0 },
            }
            logStage(pipelineRunId, 'verification_plan_enqueue', {
              status: 'warning',
              error: err instanceof Error ? err.message : 'enqueue failed',
            })
          }

          const missionEnqueueStart = Date.now()
          try {
            const { enqueueMissionCreationJobs } = await import(
              '@/pipeline/engines/missions/mission-creation-jobs.engine'
            )
            const missionEnqueue = await enqueueMissionCreationJobs({
              limit: 10000,
              force: false,
            })
            stages.mission_creation_enqueue = {
              status: 'success',
              duration_ms: Date.now() - missionEnqueueStart,
              metrics: {
                jobs_created: missionEnqueue.jobs_created,
                mission_jobs_created: missionEnqueue.jobs_created,
                jobs_skipped: missionEnqueue.jobs_skipped,
                mission_profile_version: missionEnqueue.mission_profile_version,
              },
            }
          } catch (err) {
            stages.mission_creation_enqueue = {
              status: 'partial',
              duration_ms: Date.now() - missionEnqueueStart,
              error: err instanceof Error ? err.message : 'mission enqueue failed',
              error_code: 'mission_creation_enqueue_failed',
              metrics: { mission_jobs_created: 0 },
            }
            logStage(pipelineRunId, 'mission_creation_enqueue', {
              status: 'warning',
              error: err instanceof Error ? err.message : 'enqueue failed',
            })
          }

          const findingEnqueueStart = Date.now()
          try {
            const { enqueueFindingJobs } = await import(
              '@/pipeline/engines/findings/finding-jobs.engine'
            )
            const findingEnqueue = await enqueueFindingJobs({ limit: 10000, force: false })
            stages.finding_enqueue = {
              status: 'success',
              duration_ms: Date.now() - findingEnqueueStart,
              metrics: {
                jobs_created: findingEnqueue.jobs_created,
                finding_jobs_created: findingEnqueue.jobs_created,
                jobs_skipped: findingEnqueue.jobs_skipped,
                rule_set_version: findingEnqueue.rule_set_version,
              },
            }
          } catch (err) {
            stages.finding_enqueue = {
              status: 'partial',
              duration_ms: Date.now() - findingEnqueueStart,
              error: err instanceof Error ? err.message : 'finding enqueue failed',
              error_code: 'finding_enqueue_failed',
              metrics: { finding_jobs_created: 0 },
            }
            logStage(pipelineRunId, 'finding_enqueue', {
              status: 'warning',
              error: err instanceof Error ? err.message : 'enqueue failed',
            })
          }

          const priorityEnqueueStart = Date.now()
          try {
            const { enqueuePriorityJobs } = await import(
              '@/pipeline/engines/priorities/priority-jobs.engine'
            )
            const priorityEnqueue = await enqueuePriorityJobs({ limit: 10000, force: false })
            stages.priority_enqueue = {
              status: 'success',
              duration_ms: Date.now() - priorityEnqueueStart,
              metrics: {
                jobs_created: priorityEnqueue.jobs_created,
                priority_jobs_created: priorityEnqueue.jobs_created,
                jobs_skipped: priorityEnqueue.jobs_skipped,
                priority_model_version: priorityEnqueue.priority_model_version,
              },
            }
          } catch (err) {
            stages.priority_enqueue = {
              status: 'partial',
              duration_ms: Date.now() - priorityEnqueueStart,
              error: err instanceof Error ? err.message : 'priority enqueue failed',
              error_code: 'priority_enqueue_failed',
              metrics: { priority_jobs_created: 0 },
            }
            logStage(pipelineRunId, 'priority_enqueue', {
              status: 'warning',
              error: err instanceof Error ? err.message : 'enqueue failed',
            })
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
