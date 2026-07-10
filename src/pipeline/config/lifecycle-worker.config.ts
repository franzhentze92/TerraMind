export function loadLifecycleWorkerConfig() {
  return {
    evaluationEnabled: process.env.LIFECYCLE_EVALUATION_ENABLED !== 'false',
    workerConcurrency: Number(process.env.LIFECYCLE_WORKER_CONCURRENCY ?? 1),
    lockTimeoutMinutes: Number(process.env.LIFECYCLE_JOB_LOCK_TIMEOUT_MINUTES ?? 30),
    maxAttempts: Number(process.env.LIFECYCLE_JOB_MAX_ATTEMPTS ?? 3),
    jobTimeoutMs: Number(process.env.LIFECYCLE_JOB_TIMEOUT_MS ?? 120_000),
  }
}

export function lifecycleRetryBackoffMinutes(attempt: number): number {
  const schedule = [2, 5, 15]
  return schedule[Math.min(attempt - 1, schedule.length - 1)] ?? 15
}
