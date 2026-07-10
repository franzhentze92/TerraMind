function readInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'true' || raw === 'yes'
}

export function loadClimateWorkerConfig() {
  return {
    enrichmentEnabled: readBool('CLIMATE_ENRICHMENT_ENABLED', true),
    workerConcurrency: readInt('CLIMATE_WORKER_CONCURRENCY', 2),
    lockTimeoutMinutes: readInt('CLIMATE_JOB_LOCK_TIMEOUT_MINUTES', 30),
    maxAttempts: readInt('CLIMATE_JOB_MAX_ATTEMPTS', 3),
    jobTimeoutMs: readInt('CLIMATE_JOB_TIMEOUT_MS', 120_000),
  }
}

export function climateRetryBackoffMinutes(attempt: number): number {
  const schedule = [2, 5, 15]
  return schedule[Math.min(attempt - 1, schedule.length - 1)] ?? 15
}
