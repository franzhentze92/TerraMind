import type { NewsSourceConnectorConfig } from '../types/news.types'

export interface RevalidationInput {
  /** lastmod o publication_date que trae el sitemap (sin fetch del artículo). */
  sitemapLastmod?: string | null
  /** modified_at almacenado del documento existente. */
  storedModifiedAt?: string | null
  /** published_at almacenado del documento existente. */
  storedPublishedAt?: string | null
  /** Última vez que se revisó/revalidó el documento (o updated_at). */
  lastCheckedAt: string
  isLiveCoverage: boolean
  isCorrection: boolean
}

export type RevalidationReason =
  | 'lastmod_newer'
  | 'live_window'
  | 'correction_window'
  | 'standard_window'
  | 'fresh'

export interface RevalidationDecision {
  fetch: boolean
  reason: RevalidationReason
}

function parse(iso?: string | null): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}

/**
 * Decide si un documento existente necesita descargarse de nuevo.
 * No depende del título: usa lastmod del sitemap y ventanas por tipo.
 */
export function decideRevalidation(
  input: RevalidationInput,
  config: NewsSourceConnectorConfig,
  now: number = Date.now(),
): RevalidationDecision {
  const sitemapTs = parse(input.sitemapLastmod)
  const storedTs = parse(input.storedModifiedAt) ?? parse(input.storedPublishedAt)

  // 1. El sitemap declara una modificación posterior a lo que tenemos.
  if (sitemapTs != null && storedTs != null && sitemapTs > storedTs + 60_000) {
    return { fetch: true, reason: 'lastmod_newer' }
  }

  // 2. Ventana de revalidación por tipo (evita revalidar en cada corrida).
  const checkedTs = parse(input.lastCheckedAt) ?? 0
  const ageMs = now - checkedTs

  if (input.isLiveCoverage) {
    const windowMs = (config.liveCoverageRevalidateMinutes ?? 30) * 60_000
    return ageMs > windowMs
      ? { fetch: true, reason: 'live_window' }
      : { fetch: false, reason: 'fresh' }
  }

  if (input.isCorrection) {
    const windowMs = (config.correctionRevalidateHours ?? 6) * 3_600_000
    return ageMs > windowMs
      ? { fetch: true, reason: 'correction_window' }
      : { fetch: false, reason: 'fresh' }
  }

  const windowMs = (config.revalidateAfterHours ?? 24) * 3_600_000
  return ageMs > windowMs
    ? { fetch: true, reason: 'standard_window' }
    : { fetch: false, reason: 'fresh' }
}
