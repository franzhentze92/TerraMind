export function loadVerificationWorkerConfig() {
  return {
    evaluationEnabled: process.env.VERIFICATION_PLAN_ENABLED !== 'false',
    workerConcurrency: Number(process.env.VERIFICATION_WORKER_CONCURRENCY ?? 1),
    lockTimeoutMinutes: Number(process.env.VERIFICATION_JOB_LOCK_TIMEOUT_MINUTES ?? 30),
    maxAttempts: Number(process.env.VERIFICATION_JOB_MAX_ATTEMPTS ?? 3),
    jobTimeoutMs: Number(process.env.VERIFICATION_JOB_TIMEOUT_MS ?? 120_000),
  }
}

export function verificationRetryBackoffMinutes(attempt: number): number {
  const schedule = [2, 5, 15]
  return schedule[Math.min(attempt - 1, schedule.length - 1)] ?? 15
}
