import type { IncomingMessage, ServerResponse } from 'node:http'

const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']

function parseAllowedOrigins(): string[] {
  const raw = process.env.TERRAMIND_ALLOWED_ORIGINS?.trim()
  if (!raw) return DEFAULT_ORIGINS
  return raw.split(',').map((o) => o.trim()).filter(Boolean)
}

const ALLOWED_ORIGINS = parseAllowedOrigins()

export function resolveCorsOrigin(req: IncomingMessage): string | null {
  const origin = req.headers.origin
  if (!origin) return ALLOWED_ORIGINS[0] ?? null
  return ALLOWED_ORIGINS.includes(origin) ? origin : null
}

export function setCorsHeaders(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = resolveCorsOrigin(req)
  if (!origin) return false
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  return true
}

export function handlePreflight(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method !== 'OPTIONS') return false
  if (!setCorsHeaders(req, res)) {
    res.writeHead(403)
    res.end()
    return true
  }
  res.writeHead(204, {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  })
  res.end()
  return true
}
