export function loadIncidentWorkerConfig() {
  return {
    evaluationEnabled: process.env.INCIDENT_CORRELATION_ENABLED !== 'false',
    workerConcurrency: Number(process.env.INCIDENT_WORKER_CONCURRENCY ?? 1),
    lockTimeoutMinutes: Number(process.env.INCIDENT_JOB_LOCK_TIMEOUT_MINUTES ?? 30),
    maxAttempts: Number(process.env.INCIDENT_JOB_MAX_ATTEMPTS ?? 3),
    jobTimeoutMs: Number(process.env.INCIDENT_JOB_TIMEOUT_MS ?? 120_000),
  }
}

export function incidentRetryBackoffMinutes(attempt: number): number {
  const schedule = [2, 5, 15]
  return schedule[Math.min(attempt - 1, schedule.length - 1)] ?? 15
}
