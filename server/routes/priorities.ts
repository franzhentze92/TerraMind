import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  getPriorityDetail,
  getPriorityForFireEvent,
  listPriorities,
} from '../services/priorities.service.js'
import { authorizePriorityAccess } from '../services/authorization/index.js'
import { runOperationalGuard } from '../middleware/operational-guard.js'
import { rejectInvalidUuid } from '../http/route-utils.js'
import { jsonError, jsonResponse } from '../http/json.js'

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

  try {
    const detailMatch = pathname.match(/^\/api\/intelligence\/priorities\/([^/]+)$/)
    if (detailMatch) {
      const id = detailMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de evaluación')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'priorities.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizePriorityAccess(auth, id),
        },
        async () => getPriorityDetail(id),
      )
      if (result === null) return true
      if (!result) {
        jsonError(req, res, 'Evaluación no encontrada', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    if (pathname === '/api/intelligence/priorities') {
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'priorities.view', rateLimit: 'default_read' },
        async (auth) =>
          listPriorities(
            {
              attention_level: searchParams.get('attention_level') ?? undefined,
              verification_level: searchParams.get('verification_level') ?? undefined,
              action_level: searchParams.get('action_level') ?? undefined,
              department_code: searchParams.get('department_code') ?? undefined,
              dominant_domain: searchParams.get('dominant_domain') ?? undefined,
              limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
              offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
            },
            auth,
          ),
      )
      if (result === null) return true
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

  const eventId = match[1]
  if (rejectInvalidUuid(req, res, eventId, 'ID de evento')) return true

  try {
    const result = await runOperationalGuard(
      req,
      res,
      { permission: 'priorities.view', rateLimit: 'default_read' },
      async () => getPriorityForFireEvent(eventId),
    )
    if (result === null) return true
    jsonResponse(req, res, result)
    return true
  } catch (err) {
    jsonError(req, res, err instanceof Error ? err.message : 'Error interno', 500)
    return true
  }
}
