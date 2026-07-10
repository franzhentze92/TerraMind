import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  getFireEventIncident,
  getIncidentDetail,
  getIncidentEvents,
  getIncidentHistory,
  listIncidentsDto,
} from '../services/incidents.service.js'
import { authorizeIncidentAccess } from '../services/authorization/index.js'
import { runOperationalGuard } from '../middleware/operational-guard.js'
import { rejectInvalidUuid, UUID_RE } from '../http/route-utils.js'
import { jsonError, jsonResponse } from '../http/json.js'

export async function handleIncidentsRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
): Promise<boolean> {
  if (!pathname.startsWith('/api/intelligence/incidents')) return false
  if (req.method !== 'GET') {
    jsonError(req, res, 'Method not allowed', 405)
    return true
  }

  try {
    const historyMatch = pathname.match(/^\/api\/intelligence\/incidents\/([^/]+)\/history$/)
    const eventsMatch = pathname.match(/^\/api\/intelligence\/incidents\/([^/]+)\/events$/)
    const detailMatch = pathname.match(/^\/api\/intelligence\/incidents\/([^/]+)$/)

    if (historyMatch) {
      const id = historyMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de incidente')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'incidents.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeIncidentAccess(auth, id),
        },
        async () => getIncidentHistory(id),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (eventsMatch) {
      const id = eventsMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de incidente')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'incidents.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeIncidentAccess(auth, id),
        },
        async () => getIncidentEvents(id),
      )
      if (result === null) return true
      if (!result) {
        jsonError(req, res, 'Incidente no encontrado', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    if (detailMatch) {
      const id = detailMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de incidente')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'incidents.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeIncidentAccess(auth, id),
        },
        async () => getIncidentDetail(id),
      )
      if (result === null) return true
      if (!result) {
        jsonError(req, res, 'Incidente no encontrado', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    if (pathname === '/api/intelligence/incidents') {
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'incidents.view', rateLimit: 'default_read' },
        async (auth) =>
          listIncidentsDto(
            {
              status: searchParams.get('status') ?? undefined,
              attention_level: searchParams.get('attention_level') ?? undefined,
              verification_level: searchParams.get('verification_level') ?? undefined,
              domain: searchParams.get('domain') ?? undefined,
              limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
            },
            auth,
          ),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    return false
  } catch (err) {
    jsonError(req, res, err instanceof Error ? err.message : 'Error interno', 500)
    return true
  }
}

export async function handleFireEventIncidentRoute(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  const match = pathname.match(/^\/api\/environment\/fires\/events\/([^/]+)\/incident$/)
  if (!match) return false
  if (req.method !== 'GET') {
    jsonError(req, res, 'Method not allowed', 405)
    return true
  }

  const eventId = match[1]
  if (!UUID_RE.test(eventId)) {
    jsonError(req, res, 'ID de evento inválido', 400)
    return true
  }

  try {
    const result = await runOperationalGuard(
      req,
      res,
      { permission: 'incidents.view', rateLimit: 'default_read' },
      async () => getFireEventIncident(eventId),
    )
    if (result === null) return true
    if (!result) {
      jsonResponse(req, res, { incident: null, recent_evaluations: [], generated_at: new Date().toISOString() })
      return true
    }
    jsonResponse(req, res, result)
    return true
  } catch (err) {
    jsonError(req, res, err instanceof Error ? err.message : 'Error interno', 500)
    return true
  }
}
