export function loadPriorityWorkerConfig() {
  return {
    evaluationEnabled: process.env.PRIORITY_EVALUATION_ENABLED !== 'false',
    workerConcurrency: Number(process.env.PRIORITY_WORKER_CONCURRENCY ?? 1),
    lockTimeoutMinutes: Number(process.env.PRIORITY_JOB_LOCK_TIMEOUT_MINUTES ?? 30),
    maxAttempts: Number(process.env.PRIORITY_JOB_MAX_ATTEMPTS ?? 3),
    jobTimeoutMs: Number(process.env.PRIORITY_JOB_TIMEOUT_MS ?? 120_000),
  }
}

export function priorityRetryBackoffMinutes(attempt: number): number {
  const schedule = [2, 5, 15]
  return schedule[Math.min(attempt - 1, schedule.length - 1)] ?? 15
}
