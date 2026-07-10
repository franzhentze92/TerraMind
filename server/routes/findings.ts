import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  getFindingDetail,
  getFindingsForFireEvent,
  listFindings,
} from '../services/findings.service.js'
import { authorizeFindingAccess } from '../services/authorization/index.js'
import { runOperationalGuard } from '../middleware/operational-guard.js'
import { rejectInvalidUuid } from '../http/route-utils.js'
import { jsonError, jsonResponse } from '../http/json.js'

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

  try {
    const detailMatch = pathname.match(/^\/api\/intelligence\/findings\/([^/]+)$/)
    if (detailMatch) {
      const id = detailMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de hallazgo')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'findings.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeFindingAccess(auth, id),
        },
        async () => getFindingDetail(id),
      )
      if (result === null) return true
      if (!result) {
        jsonError(req, res, 'Hallazgo no encontrado', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    if (pathname === '/api/intelligence/findings') {
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'findings.view', rateLimit: 'default_read' },
        async (auth) =>
          listFindings(
            {
              status: searchParams.get('status') ?? undefined,
              finding_type: searchParams.get('finding_type') ?? undefined,
              entity_type: searchParams.get('entity_type') ?? undefined,
              entity_id: searchParams.get('entity_id') ?? undefined,
              department_code: searchParams.get('department_code') ?? undefined,
              confidence: searchParams.get('confidence') ?? undefined,
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

  const eventId = match[1]
  if (rejectInvalidUuid(req, res, eventId, 'ID de evento')) return true

  try {
    const result = await runOperationalGuard(
      req,
      res,
      { permission: 'incidents.view', rateLimit: 'default_read' },
      async () => getFindingsForFireEvent(eventId),
    )
    if (result === null) return true
    jsonResponse(req, res, result)
    return true
  } catch (err) {
    jsonError(req, res, err instanceof Error ? err.message : 'Error interno', 500)
    return true
  }
}
