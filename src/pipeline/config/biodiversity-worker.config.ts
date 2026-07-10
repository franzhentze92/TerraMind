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

export function loadBiodiversityWorkerConfig() {
  return {
    enrichmentEnabled: readBool('BIODIVERSITY_ENRICHMENT_ENABLED', true),
    workerConcurrency: readInt('BIODIVERSITY_WORKER_CONCURRENCY', 1),
    lockTimeoutMinutes: readInt('BIODIVERSITY_JOB_LOCK_TIMEOUT_MINUTES', 30),
    maxAttempts: readInt('BIODIVERSITY_JOB_MAX_ATTEMPTS', 3),
    jobTimeoutMs: readInt('BIODIVERSITY_JOB_TIMEOUT_MS', 180_000),
  }
}

export function biodiversityRetryBackoffMinutes(attempt: number): number {
  const schedule = [5, 15, 30]
  return schedule[Math.min(attempt - 1, schedule.length - 1)] ?? 30
}
