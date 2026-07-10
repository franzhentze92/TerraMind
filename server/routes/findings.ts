import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  getFindingDetail,
  getFindingsForFireEvent,
  listFindings,
} from '../services/findings.service.js'
import { rejectIfUnauthenticated } from '../middleware/auth.js'
import { jsonError, jsonResponse } from '../http/json.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function handleFindingsRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
): Promise<boolean> {
  if (!pathname.startsWith('/api/intelligence/findings')) return false
  if (req.method !== 'GET') {
    jsonError(req, res, 'Method not allowed', 405)
    return true
  }
  if (await rejectIfUnauthenticated(req, res)) return true

  try {
    const detailMatch = pathname.match(/^\/api\/intelligence\/findings\/([^/]+)$/)
    if (detailMatch) {
      const id = detailMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID de hallazgo inválido', 400)
        return true
      }
      const detail = await getFindingDetail(id)
      if (!detail) {
        jsonError(req, res, 'Hallazgo no encontrado', 404)
        return true
      }
      jsonResponse(req, res, detail)
      return true
    }

    if (pathname === '/api/intelligence/findings') {
      const result = await listFindings({
        status: searchParams.get('status') ?? undefined,
        finding_type: searchParams.get('finding_type') ?? undefined,
        entity_type: searchParams.get('entity_type') ?? undefined,
        entity_id: searchParams.get('entity_id') ?? undefined,
        department_code: searchParams.get('department_code') ?? undefined,
        confidence: searchParams.get('confidence') ?? undefined,
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

export async function handleFireFindingsRoute(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  const match = pathname.match(/^\/api\/environment\/fires\/events\/([^/]+)\/findings$/)
  if (!match) return false
  if (req.method !== 'GET') {
    jsonError(req, res, 'Method not allowed', 405)
    return true
  }
  if (await rejectIfUnauthenticated(req, res)) return true

  const eventId = match[1]
  if (!UUID_RE.test(eventId)) {
    jsonError(req, res, 'ID de evento inválido', 400)
    return true
  }

  try {
    const result = await getFindingsForFireEvent(eventId)
    jsonResponse(req, res, result)
    return true
  } catch (err) {
    jsonError(req, res, err instanceof Error ? err.message : 'Error interno', 500)
    return true
  }
}
