export interface ResponseOrchestrationWorkerConfig {
  enabled: boolean
  intervalSeconds: number
  pollIdleMs: number
  lockTimeoutMinutes: number
  runOnStartup: boolean
}

export function loadResponseOrchestrationWorkerConfig(): ResponseOrchestrationWorkerConfig {
  const enabled = process.env.RESPONSE_ORCHESTRATION_WORKER_ENABLED !== 'false'
  const intervalSeconds = Math.max(
    5,
    Number(process.env.RESPONSE_ORCHESTRATION_WORKER_INTERVAL_SECONDS ?? 30),
  )
  const pollIdleMs = Math.max(
    500,
    Number(process.env.RESPONSE_ORCHESTRATION_WORKER_IDLE_MS ?? 2000),
  )
  const lockTimeoutMinutes = Math.max(
    1,
    Number(process.env.RESPONSE_ORCHESTRATION_LOCK_TIMEOUT_MINUTES ?? 15),
  )
  const runOnStartup = process.env.RESPONSE_ORCHESTRATION_WORKER_RUN_ON_STARTUP !== 'false'
  return { enabled, intervalSeconds, pollIdleMs, lockTimeoutMinutes, runOnStartup }
}
