import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  getPriorityDetail,
  getPriorityForFireEvent,
  listPriorities,
} from '../services/priorities.service.js'
import { rejectIfUnauthenticated } from '../middleware/auth.js'
import { jsonError, jsonResponse } from '../http/json.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function handlePrioritiesRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
): Promise<boolean> {
  if (!pathname.startsWith('/api/intelligence/priorities')) return false
  if (req.method !== 'GET') {
    jsonError(req, res, 'Method not allowed', 405)
    return true
  }
  if (rejectIfUnauthenticated(req, res)) return true

  try {
    const detailMatch = pathname.match(/^\/api\/intelligence\/priorities\/([^/]+)$/)
    if (detailMatch) {
      const id = detailMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID de evaluación inválido', 400)
        return true
      }
      const detail = await getPriorityDetail(id)
      if (!detail) {
        jsonError(req, res, 'Evaluación no encontrada', 404)
        return true
      }
      jsonResponse(req, res, detail)
      return true
    }

    if (pathname === '/api/intelligence/priorities') {
      const result = await listPriorities({
        attention_level: searchParams.get('attention_level') ?? undefined,
        verification_level: searchParams.get('verification_level') ?? undefined,
        action_level: searchParams.get('action_level') ?? undefined,
        department_code: searchParams.get('department_code') ?? undefined,
        dominant_domain: searchParams.get('dominant_domain') ?? undefined,
        limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
        offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
      })
      jsonResponse(req, res, result)
      return true
    }

    jsonError(req, res, 'Not found', 404)
    return true
  } catch (err) {
    jsonError(req, res, err instanceof Error ? err.message : 'Error interno', 500)
    return true
  }
}

export async function handleFirePriorityRoute(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  const match = pathname.match(/^\/api\/environment\/fires\/events\/([^/]+)\/priority$/)
  if (!match) return false
  if (req.method !== 'GET') {
    jsonError(req, res, 'Method not allowed', 405)
    return true
  }
  if (rejectIfUnauthenticated(req, res)) return true

  const eventId = match[1]
  if (!UUID_RE.test(eventId)) {
    jsonError(req, res, 'ID de evento inválido', 400)
    return true
  }

  try {
    const result = await getPriorityForFireEvent(eventId)
    jsonResponse(req, res, result)
    return true
  } catch (err) {
    jsonError(req, res, err instanceof Error ? err.message : 'Error interno', 500)
    return true
  }
}
