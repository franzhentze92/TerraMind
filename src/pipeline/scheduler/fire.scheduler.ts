import {
  loadFirePipelineConfig,
  sanitizeFirePipelineConfigForLogs,
} from '@/pipeline/config/fire-pipeline.config'
import {
  isFirePipelineRunning,
  runFirePipeline,
} from '@/pipeline/jobs/fire-pipeline.job'

let intervalId: ReturnType<typeof setInterval> | null = null
let nextRunAt: Date | null = null
let lastRunAt: Date | null = null
let config = loadFirePipelineConfig()

export function getFirePipelineNextRunAt(): string | null {
  return nextRunAt?.toISOString() ?? null
}

export function getFirePipelineLastRunAt(): string | null {
  return lastRunAt?.toISOString() ?? null
}

export function getFireSchedulerConfig() {
  return { ...config }
}

async function executeScheduledRun(triggerType: 'scheduled' | 'startup'): Promise<void> {
  lastRunAt = new Date()
  const result = await runFirePipeline({ triggerType })
  console.log(
    JSON.stringify({
      event: 'fire_pipeline_complete',
      pipeline_run_id: result.pipelineRunId,
      status: result.status,
      duration_ms: result.durationMs,
      trigger_type: triggerType,
    }),
  )
}

export function startFireScheduler(): void {
  config = loadFirePipelineConfig()

  if (!config.enabled) {
    console.log('[TerraMind] Pipeline FIRMS deshabilitado (FIRE_PIPELINE_ENABLED=false)')
    return
  }

  if (intervalId) return

  const intervalMs = config.intervalMinutes * 60_000
  console.log(
    '[TerraMind] Pipeline FIRMS configurado:',
    sanitizeFirePipelineConfigForLogs(config),
  )
  console.log(`[TerraMind] Scheduler FIRMS — cada ${config.intervalMinutes} minutos`)

  if (config.runOnStartup) {
    void executeScheduledRun('startup')
  }

  nextRunAt = new Date(Date.now() + intervalMs)

  intervalId = setInterval(() => {
    nextRunAt = new Date(Date.now() + intervalMs)
    void executeScheduledRun('scheduled')
  }, intervalMs)
}

export function stopFireScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  nextRunAt = null
}

export function isFireSchedulerActive(): boolean {
  return intervalId !== null
}

export { isFirePipelineRunning }
