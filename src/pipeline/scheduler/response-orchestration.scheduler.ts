import { loadResponseOrchestrationWorkerConfig } from '@/pipeline/config/response-orchestration-worker.config'
import {
  ResponseOrchestrationWorker,
  getResponseOrchestrationOperationalHealth,
  markResponseOrchestrationWorkerStarted,
  markResponseOrchestrationWorkerStopped,
} from '@/pipeline/workers/response-orchestration.worker'

let intervalId: ReturnType<typeof setInterval> | null = null
let draining = false
let loopPromise: Promise<void> | null = null

async function drainLoop(worker: ResponseOrchestrationWorker, idleMs: number): Promise<void> {
  while (!draining) {
    try {
      const processed = await worker.runOnce()
      if (!processed) await new Promise((r) => setTimeout(r, idleMs))
    } catch (err) {
      console.error('[response-orchestration-scheduler] loop error', err)
      await new Promise((r) => setTimeout(r, idleMs))
    }
  }
}

export function startResponseOrchestrationScheduler(): void {
  const config = loadResponseOrchestrationWorkerConfig()
  if (!config.enabled) {
    console.log('[TerraMind] Response orchestration worker deshabilitado (RESPONSE_ORCHESTRATION_WORKER_ENABLED=false)')
    return
  }
  if (intervalId) return

  const worker = new ResponseOrchestrationWorker(`server-${process.pid}`)
  markResponseOrchestrationWorkerStarted()
  draining = false

  console.log(
    `[TerraMind] Response orchestration worker — intervalo ${config.intervalSeconds}s, lock ${config.lockTimeoutMinutes}m`,
  )

  if (config.runOnStartup) {
    void worker.runOnce()
  }

  loopPromise = drainLoop(worker, config.pollIdleMs)

  intervalId = setInterval(() => {
    void worker.runOnce()
  }, config.intervalSeconds * 1000)
}

export function stopResponseOrchestrationScheduler(): void {
  draining = true
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  markResponseOrchestrationWorkerStopped()
}

export function isResponseOrchestrationSchedulerActive(): boolean {
  return intervalId !== null
}

export async function getResponseOrchestrationSchedulerHealth() {
  const config = loadResponseOrchestrationWorkerConfig()
  const health = await getResponseOrchestrationOperationalHealth()
  return {
    scheduler_active: isResponseOrchestrationSchedulerActive(),
    config: {
      enabled: config.enabled,
      interval_seconds: config.intervalSeconds,
      lock_timeout_minutes: config.lockTimeoutMinutes,
    },
    worker: health,
  }
}

export async function awaitResponseOrchestrationSchedulerDrain(): Promise<void> {
  if (loopPromise) await loopPromise
}
