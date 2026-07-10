import { withRetry, sleep } from '@/pipeline/utils/retry'
import { withTimeout } from '@/pipeline/utils/timeout'
import { BIODIVERSITY_CONFIG } from '../../config/biodiversity.config'
import { GbifApiError } from './gbif.types'

function isTransientGbifError(err: unknown): boolean {
  if (!(err instanceof GbifApiError)) return false
  if (err.code === 'TIMEOUT' || err.code === 'NETWORK') return true
  if (err.code === 'RATE_LIMIT') return true
  if (err.code === 'HTTP_ERROR' && err.status !== undefined && err.status >= 500) return true
  return false
}

export interface GbifRequestOptions {
  path: string
  searchParams?: Record<string, string | number | boolean | undefined>
  cacheKey?: string
  cacheTtlMs?: number
}

export async function gbifFetchJson<T>(
  options: GbifRequestOptions,
  stage: string,
): Promise<T> {
  const base = BIODIVERSITY_CONFIG.gbif.baseUrl.replace(/\/$/, '')
  const search = new URLSearchParams()
  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      if (value === undefined || value === null || value === '') continue
      search.set(key, String(value))
    }
  }
  const url = `${base}${options.path}${search.size ? `?${search.toString()}` : ''}`

  return withRetry(
    async () => {
      const controller = new AbortController()
      const started = Date.now()
      try {
        const response = await withTimeout(
          fetch(url, {
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
              'User-Agent': BIODIVERSITY_CONFIG.userAgent,
            },
          }),
          BIODIVERSITY_CONFIG.requestTimeoutMs,
          stage,
        )

        if (response.status === 429) {
          throw new GbifApiError('RATE_LIMIT', 'GBIF rate limit (HTTP 429)', 429)
        }

        if (!response.ok) {
          throw new GbifApiError(
            'HTTP_ERROR',
            `GBIF respondió ${response.status}`,
            response.status,
          )
        }

        const json = (await response.json()) as T
        void started
        return json
      } catch (err) {
        if (err instanceof GbifApiError) throw err
        if (err instanceof Error && err.name === 'AbortError') {
          throw new GbifApiError('TIMEOUT', `GBIF timeout en ${stage}`)
        }
        throw new GbifApiError('NETWORK', err instanceof Error ? err.message : 'Error de red GBIF')
      } finally {
        controller.abort()
      }
    },
    {
      shouldRetry: isTransientGbifError,
      onBackoff: async (_attempt, waitMs) => {
        await sleep(waitMs)
      },
    },
  )
}
