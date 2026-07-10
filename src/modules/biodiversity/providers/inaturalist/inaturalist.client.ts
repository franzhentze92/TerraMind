import { withRetry, sleep } from '@/pipeline/utils/retry'
import { withTimeout } from '@/pipeline/utils/timeout'
import { BIODIVERSITY_CONFIG } from '../../config/biodiversity.config'
import { InaturalistApiError } from './inaturalist.types'

function isTransientInatError(err: unknown): boolean {
  if (!(err instanceof InaturalistApiError)) return false
  if (err.code === 'TIMEOUT' || err.code === 'NETWORK') return true
  if (err.code === 'RATE_LIMIT') return true
  if (err.code === 'HTTP_ERROR' && err.status !== undefined && err.status >= 500) return true
  return false
}

export async function inaturalistFetchJson<T>(
  path: string,
  searchParams?: Record<string, string | number | boolean | undefined>,
  stage = 'inaturalist',
): Promise<T> {
  const base = BIODIVERSITY_CONFIG.inaturalist.baseUrl.replace(/\/$/, '')
  const search = new URLSearchParams()
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined || value === null || value === '') continue
      search.set(key, String(value))
    }
  }
  const url = `${base}${path}${search.size ? `?${search.toString()}` : ''}`

  return withRetry(
    async () => {
      const controller = new AbortController()
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
          throw new InaturalistApiError('RATE_LIMIT', 'iNaturalist rate limit (HTTP 429)', 429)
        }

        if (!response.ok) {
          throw new InaturalistApiError(
            'HTTP_ERROR',
            `iNaturalist respondió ${response.status}`,
            response.status,
          )
        }

        return (await response.json()) as T
      } catch (err) {
        if (err instanceof InaturalistApiError) throw err
        if (err instanceof Error && err.name === 'AbortError') {
          throw new InaturalistApiError('TIMEOUT', `iNaturalist timeout en ${stage}`)
        }
        throw new InaturalistApiError(
          'NETWORK',
          err instanceof Error ? err.message : 'Error de red iNaturalist',
        )
      } finally {
        controller.abort()
      }
    },
    {
      shouldRetry: isTransientInatError,
      onBackoff: async (_attempt, waitMs) => {
        await sleep(waitMs)
      },
    },
  )
}
