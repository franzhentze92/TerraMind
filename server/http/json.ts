import type { IncomingMessage, ServerResponse } from 'node:http'
import { setCorsHeaders } from './cors.js'

export function jsonResponse(
  req: IncomingMessage,
  res: ServerResponse,
  data: unknown,
  status = 200,
) {
  if (!setCorsHeaders(req, res)) {
    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Origin not allowed' }))
    return
  }
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

export function jsonError(
  req: IncomingMessage,
  res: ServerResponse,
  message: string,
  status = 400,
) {
  jsonResponse(req, res, { error: message }, status)
}
