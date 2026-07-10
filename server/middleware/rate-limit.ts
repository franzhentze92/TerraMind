import type { IncomingMessage, ServerResponse } from 'node:http'

interface RateBucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateBucket>()

export type RateLimitProfile =
  | 'login'
  | 'org_switch'
  | 'signed_url'
  | 'package_generate'
  | 'package_download'
  | 'evidence_create'
  | 'upload_session'
  | 'field_sync_register'
  | 'sync_retry'
  | 'invitation'
  | 'validation'
  | 'reevaluation'
  | 'biodiversity_read'
  | 'default_read'

const PROFILES: Record<RateLimitProfile, { maxRequests: number; windowMs: number }> = {
  login: { maxRequests: 20, windowMs: 60_000 },
  org_switch: { maxRequests: 30, windowMs: 60_000 },
  signed_url: { maxRequests: 60, windowMs: 60_000 },
  package_generate: { maxRequests: 20, windowMs: 60_000 },
  package_download: { maxRequests: 40, windowMs: 60_000 },
  evidence_create: { maxRequests: 40, windowMs: 60_000 },
  upload_session: { maxRequests: 80, windowMs: 60_000 },
  field_sync_register: { maxRequests: 40, windowMs: 60_000 },
  sync_retry: { maxRequests: 60, windowMs: 60_000 },
  invitation: { maxRequests: 20, windowMs: 60_000 },
  validation: { maxRequests: 30, windowMs: 60_000 },
  reevaluation: { maxRequests: 20, windowMs: 60_000 },
  biodiversity_read: { maxRequests: 60, windowMs: 60_000 },
  default_read: { maxRequests: 120, windowMs: 60_000 },
}

function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? 'unknown'
  return req.socket.remoteAddress ?? 'unknown'
}

function bucketKey(req: IncomingMessage, profile: RateLimitProfile): string {
  const authHeader = req.headers.authorization ?? 'anon'
  return `${profile}:${clientIp(req)}:${String(authHeader).slice(0, 24)}`
}

export function rejectIfRateLimited(
  req: IncomingMessage,
  res: ServerResponse,
  profileOrOptions: RateLimitProfile | { maxRequests?: number; windowMs?: number } = 'default_read',
): boolean {
  const options =
    typeof profileOrOptions === 'string' ? PROFILES[profileOrOptions] : profileOrOptions
  const maxRequests = options.maxRequests ?? 60
  const windowMs = options.windowMs ?? 60_000
  const key =
    typeof profileOrOptions === 'string'
      ? bucketKey(req, profileOrOptions)
      : `${clientIp(req)}:custom`
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
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

export function resetRateLimitBuckets(): void {
  buckets.clear()
}

export function rateLimitProfiles(): string[] {
  return Object.keys(PROFILES)
}
