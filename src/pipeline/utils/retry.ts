import { FirmsApiError } from '@/pipeline/connectors/firms.connector'
import { PIPELINE_RETRY } from '@/pipeline/config/fire-pipeline.config'

export function isTransientFirmsError(err: unknown): boolean {
  if (!(err instanceof FirmsApiError)) return false
  if (err.code === 'TIMEOUT' || err.code === 'NETWORK') return true
  if (err.code === 'HTTP_ERROR' && err.status !== undefined && err.status >= 500) return true
  return false
}

export function isTransientError(err: unknown): boolean {
  if (err instanceof Error && err.name === 'StageTimeoutError') return false
  if (isTransientFirmsError(err)) return true
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    return msg.includes('fetch failed') || msg.includes('econnreset') || msg.includes('etimedout')
  }
  return false
}

function jitter(ms: number): number {
  return Math.floor(Math.random() * ms)
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export interface RetryOptions {
  maxAttempts?: number
  backoffMs?: readonly number[]
  jitterMs?: number
  shouldRetry?: (err: unknown, attempt: number) => boolean
  onBackoff?: (attempt: number, waitMs: number) => Promise<void>
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? PIPELINE_RETRY.maxAttempts
  const backoffMs = options.backoffMs ?? PIPELINE_RETRY.backoffMs
  const jitterMs = options.jitterMs ?? PIPELINE_RETRY.jitterMs
  const shouldRetry = options.shouldRetry ?? isTransientError

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt)
    } catch (err) {
      lastError = err
      if (attempt >= maxAttempts || !shouldRetry(err, attempt)) throw err
      const wait =
        (backoffMs[attempt - 1] ?? backoffMs[backoffMs.length - 1] ?? 30_000) + jitter(jitterMs)
      if (options.onBackoff) await options.onBackoff(attempt, wait)
      else await sleep(wait)
    }
  }
  throw lastError
}
