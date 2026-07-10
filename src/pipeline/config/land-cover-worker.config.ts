export const LAND_COVER_RETRY_BACKOFF_MINUTES = [5, 15, 60] as const

export interface LandCoverWorkerConfig {
  enrichmentEnabled: boolean
  workerConcurrency: number
  lockTimeoutMinutes: number
  maxAttempts: number
  jobTimeoutMs: number
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function parsePositiveInt(value: string | undefined, fallback: number, max: number): number {
  const raw = Number(value ?? fallback)
  if (!Number.isFinite(raw) || raw < 1) return fallback
  return Math.min(max, Math.floor(raw))
}

export function loadLandCoverWorkerConfig(): LandCoverWorkerConfig {
  return {
    enrichmentEnabled: parseBool(process.env.LAND_COVER_ENRICHMENT_ENABLED, true),
    workerConcurrency: parsePositiveInt(process.env.LAND_COVER_WORKER_CONCURRENCY, 1, 4),
    lockTimeoutMinutes: parsePositiveInt(process.env.LAND_COVER_JOB_LOCK_TIMEOUT_MINUTES, 30, 240),
    maxAttempts: parsePositiveInt(process.env.LAND_COVER_JOB_MAX_ATTEMPTS, 3, 10),
    jobTimeoutMs: parsePositiveInt(process.env.LAND_COVER_JOB_TIMEOUT_MS, 120_000, 600_000),
  }
}

export function retryBackoffMinutes(attempt: number): number {
  const idx = Math.min(Math.max(attempt - 1, 0), LAND_COVER_RETRY_BACKOFF_MINUTES.length - 1)
  return LAND_COVER_RETRY_BACKOFF_MINUTES[idx]
}
