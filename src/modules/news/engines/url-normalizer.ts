import { createHash } from 'node:crypto'

/** Normaliza URL canónica para deduplicación. */
export function normalizeCanonicalUrl(raw: string): string {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new Error(`URL inválida: ${raw}`)
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Protocolo no permitido: ${url.protocol}`)
  }

  url.hash = ''
  url.hostname = url.hostname.toLowerCase()
  if (url.pathname.endsWith('/') && url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, '')
  }

  const dropParams = new Set([
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'fbclid',
    'gclid',
  ])
  for (const key of [...url.searchParams.keys()]) {
    if (dropParams.has(key.toLowerCase())) url.searchParams.delete(key)
  }
  url.search = url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''

  return url.toString()
}

export function hashCanonicalUrl(raw: string): string {
  const normalized = normalizeCanonicalUrl(raw)
  return createHash('sha256').update(normalized).digest('hex')
}

export function hashDocumentContent(parts: Array<string | null | undefined>): string {
  const payload = parts.map((p) => (p ?? '').trim()).join('|')
  return createHash('sha256').update(payload).digest('hex')
}

export function extractDomain(url: string): string {
  return new URL(url).hostname.toLowerCase()
}

export function isUrlOnAllowedDomain(url: string, allowedDomains: string[]): boolean {
  const host = extractDomain(url)
  return allowedDomains.some((d) => host === d.toLowerCase() || host.endsWith(`.${d.toLowerCase()}`))
}
