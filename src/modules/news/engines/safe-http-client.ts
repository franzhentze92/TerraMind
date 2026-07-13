import { isIP } from 'node:net'
import { isUrlOnAllowedDomain } from './url-normalizer'

const PRIVATE_IPV4_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
]

export interface SafeFetchOptions {
  allowedDomains: string[]
  timeoutMs?: number
  maxRedirects?: number
  maxBytes?: number
  userAgent?: string
}

export class SafeFetchError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'SafeFetchError'
    this.status = status
  }
}

function isPrivateIp(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true
  const ipVersion = isIP(hostname)
  if (ipVersion === 4) return PRIVATE_IPV4_RANGES.some((re) => re.test(hostname))
  if (ipVersion === 6) {
    const lower = hostname.toLowerCase()
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')
  }
  return false
}

function assertSafeUrl(url: string, allowedDomains: string[]): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new SafeFetchError('URL inválida')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new SafeFetchError('Protocolo no permitido')
  }
  if (isPrivateIp(parsed.hostname)) {
    throw new SafeFetchError('Destino de red privada bloqueado')
  }
  if (!isUrlOnAllowedDomain(url, allowedDomains)) {
    throw new SafeFetchError(`Dominio no autorizado: ${parsed.hostname}`)
  }
}

export async function safeFetchText(
  initialUrl: string,
  options: SafeFetchOptions,
): Promise<{ url: string; text: string; status: number; headers: Headers }> {
  const timeoutMs = options.timeoutMs ?? 15_000
  const maxRedirects = options.maxRedirects ?? 5
  const maxBytes = options.maxBytes ?? 2_000_000
  const userAgent =
    options.userAgent ??
    'TerraMind-NewsBot/1.0 (+https://terramind.local; contact=news-ingestion)'

  let currentUrl = initialUrl
  for (let i = 0; i <= maxRedirects; i++) {
    assertSafeUrl(currentUrl, options.allowedDomains)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let response: Response
    try {
      response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      })
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof Error && err.name === 'AbortError') {
        throw new SafeFetchError('Tiempo de espera agotado', 408)
      }
      throw new SafeFetchError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      clearTimeout(timer)
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      if (!location) throw new SafeFetchError('Redirección sin destino', response.status)
      currentUrl = new URL(location, currentUrl).toString()
      continue
    }

    if (response.status === 403) {
      throw new SafeFetchError('Acceso bloqueado por el origen (403)', 403)
    }
    if (response.status === 429) {
      throw new SafeFetchError('Límite de solicitudes alcanzado (429)', 429)
    }
    if (!response.ok) {
      throw new SafeFetchError(`Respuesta HTTP ${response.status}`, response.status)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new SafeFetchError('Cuerpo vacío')

    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        throw new SafeFetchError('Respuesta demasiado grande')
      }
      chunks.push(value)
    }
    const text = new TextDecoder('utf-8', { fatal: false }).decode(
      chunks.length === 1 ? chunks[0]! : Buffer.concat(chunks),
    )
    return { url: currentUrl, text, status: response.status, headers: response.headers }
  }
  throw new SafeFetchError('Demasiadas redirecciones')
}

export function parseRobotsDisallows(robotsTxt: string, userAgent = '*'): string[] {
  const lines = robotsTxt.split(/\r?\n/)
  const groups: Array<{ agents: string[]; rules: string[] }> = []
  let current: { agents: string[]; rules: string[] } | null = null

  for (const raw of lines) {
    const line = raw.split('#')[0]?.trim() ?? ''
    if (!line) continue
    const [directive, ...rest] = line.split(':')
    const value = rest.join(':').trim()
    const key = directive?.toLowerCase()
    if (key === 'user-agent') {
      current = { agents: [value.toLowerCase()], rules: [] }
      groups.push(current)
    } else if (key === 'disallow' && current) {
      current.rules.push(value)
    }
  }

  const wildcard = groups.find((g) => g.agents.includes('*'))
  const specific = groups.find((g) => g.agents.includes(userAgent.toLowerCase()))
  const rules = specific?.rules ?? wildcard?.rules ?? []
  return rules.filter(Boolean)
}

export function isPathDisallowedByRobots(path: string, disallows: string[]): boolean {
  for (const rule of disallows) {
    if (!rule) continue
    if (rule === '/') return true
    if (path.startsWith(rule)) return true
    const normalized = rule.replace(/\*/g, '')
    if (normalized && path.includes(normalized)) return true
  }
  return false
}
