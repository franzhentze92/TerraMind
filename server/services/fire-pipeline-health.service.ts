import {
  loadFirePipelineConfig,
  PIPELINE_HEALTH_THRESHOLDS,
} from '@/pipeline/config/fire-pipeline.config'
import {
  countConsecutiveFailures,
  countRunsSince,
  getLastSuccessfulPipelineRun,
  getLatestPipelineRun,
  type PipelineRunRow,
} from '@/pipeline/stores/fire-pipeline.store'
import {
  getFirePipelineNextRunAt,
  getFireSchedulerConfig,
  isFirePipelineRunning,
  isFireSchedulerActive,
} from '@/pipeline/scheduler/fire.scheduler'
import type { FirePipelineHealthDto } from '@/modules/fires/types/fire.dto'

function sanitizeStageMetrics(
  stages: PipelineRunRow['stages'] | undefined,
): FirePipelineHealthDto['last_stage_metrics'] {
  if (!stages) return undefined
  const out: NonNullable<FirePipelineHealthDto['last_stage_metrics']> = {}
  for (const [key, stage] of Object.entries(stages)) {
    out[key] = {
      status: stage.status,
      duration_ms: stage.duration_ms,
      metrics: stage.metrics,
    }
  }
  return out
}

export function computeHealthFlags(input: {
  consecutiveFailures: number
  lastSuccessAt: string | null
  enabled: boolean
}): { is_healthy: boolean; is_stale: boolean; alert_level: 'ok' | 'warning' | 'critical' } {
  if (!input.enabled) {
    return { is_healthy: true, is_stale: false, alert_level: 'ok' }
  }

  const minutesSinceSuccess = input.lastSuccessAt
    ? (Date.now() - new Date(input.lastSuccessAt).getTime()) / 60_000
    : Number.POSITIVE_INFINITY

  const isStale = minutesSinceSuccess > PIPELINE_HEALTH_THRESHOLDS.warningStaleMinutes
  const criticalStale = minutesSinceSuccess > PIPELINE_HEALTH_THRESHOLDS.criticalStaleMinutes
  const criticalFailures =
    input.consecutiveFailures >= PIPELINE_HEALTH_THRESHOLDS.criticalConsecutiveFailures
  const warningFailures =
    input.consecutiveFailures >= PIPELINE_HEALTH_THRESHOLDS.warningConsecutiveFailures

  if (criticalFailures || criticalStale) {
    return { is_healthy: false, is_stale: isStale, alert_level: 'critical' }
  }
  if (warningFailures || isStale) {
    return { is_healthy: false, is_stale: isStale, alert_level: 'warning' }
  }
  return { is_healthy: true, is_stale: false, alert_level: 'ok' }
}

export async function getFirePipelineHealth(): Promise<FirePipelineHealthDto> {
  const config = getFireSchedulerConfig()
  const generatedAt = new Date().toISOString()
  const since24h = new Date(Date.now() - 24 * 60 * 60_000).toISOString()

  const [latest, lastSuccess, consecutiveFailures, failed24h, partial24h] =
    await Promise.all([
      getLatestPipelineRun(),
      getLastSuccessfulPipelineRun(),
      countConsecutiveFailures(),
      countRunsSince('failed', since24h),
      countRunsSince('partial', since24h),
    ])

  const lastSuccessAt = lastSuccess?.completed_at ?? null
  const flags = computeHealthFlags({
    consecutiveFailures,
    lastSuccessAt,
    enabled: config.enabled,
  })

  return {
    enabled: config.enabled,
    interval_minutes: config.intervalMinutes,
    is_running: isFirePipelineRunning(),
    scheduler_active: isFireSchedulerActive(),
    last_run: latest
      ? {
          status: latest.status,
          started_at: latest.started_at,
          completed_at: latest.completed_at,
          duration_ms: latest.duration_ms,
          trigger_type: latest.trigger_type,
        }
      : null,
    last_success_at: lastSuccessAt,
    consecutive_failures: consecutiveFailures,
    next_run_at: getFirePipelineNextRunAt(),
    last_stage_metrics: sanitizeStageMetrics(latest?.stages),
    failed_runs_last_24h: failed24h,
    partial_runs_last_24h: partial24h,
    is_healthy: flags.is_healthy,
    is_stale: flags.is_stale,
    alert_level: flags.alert_level,
    generated_at: generatedAt,
  }
}
