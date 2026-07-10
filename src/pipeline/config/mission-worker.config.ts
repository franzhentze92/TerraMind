export function loadMissionWorkerConfig() {
  return {
    evaluationEnabled: process.env.MISSION_CREATION_ENABLED !== 'false',
    workerConcurrency: Number(process.env.MISSION_WORKER_CONCURRENCY ?? 1),
    lockTimeoutMinutes: Number(process.env.MISSION_JOB_LOCK_TIMEOUT_MINUTES ?? 30),
    maxAttempts: Number(process.env.MISSION_JOB_MAX_ATTEMPTS ?? 3),
    jobTimeoutMs: Number(process.env.MISSION_JOB_TIMEOUT_MS ?? 120_000),
  }
}

export function missionRetryBackoffMinutes(attempt: number): number {
  const schedule = [2, 5, 15]
  return schedule[Math.min(attempt - 1, schedule.length - 1)] ?? 15
}
