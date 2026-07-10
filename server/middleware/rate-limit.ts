import type { IncomingMessage, ServerResponse } from 'node:http'

interface RateBucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateBucket>()

function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? 'unknown'
  return req.socket.remoteAddress ?? 'unknown'
}

/**
 * Rate limiting básico en memoria para rutas de biodiversidad.
 * @returns true si la solicitud debe rechazarse (429)
 */
export function rejectIfRateLimited(
  req: IncomingMessage,
  res: ServerResponse,
  options: { maxRequests?: number; windowMs?: number } = {},
): boolean {
  const maxRequests = options.maxRequests ?? 60
  const windowMs = options.windowMs ?? 60_000
  const ip = clientIp(req)
  const now = Date.now()
  const bucket = buckets.get(ip)

  if (!bucket || now > bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs })
    return false
  }

  bucket.count += 1
  if (bucket.count > maxRequests) {
    res.statusCode = 429
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)))
    res.end(JSON.stringify({ error: 'Demasiadas solicitudes. Intente más tarde.' }))
    return true
  }

  return false
}

/** Limpia buckets — solo para pruebas. */
export function resetRateLimitBuckets(): void {
  buckets.clear()
}
