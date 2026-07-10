import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  getFireEventIncident,
  getIncidentDetail,
  getIncidentEvents,
  getIncidentHistory,
  listIncidentsDto,
} from '../services/incidents.service.js'
import { rejectIfUnauthenticated } from '../middleware/auth.js'
import { jsonError, jsonResponse } from '../http/json.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
  if (await rejectIfUnauthenticated(req, res)) return true

  try {
    const historyMatch = pathname.match(/^\/api\/intelligence\/incidents\/([^/]+)\/history$/)
    const eventsMatch = pathname.match(/^\/api\/intelligence\/incidents\/([^/]+)\/events$/)
    const detailMatch = pathname.match(/^\/api\/intelligence\/incidents\/([^/]+)$/)

    if (historyMatch) {
      const id = historyMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID de incidente inválido', 400)
        return true
      }
      const history = await getIncidentHistory(id)
      jsonResponse(req, res, history)
      return true
    }

    if (eventsMatch) {
      const id = eventsMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID de incidente inválido', 400)
        return true
      }
      const events = await getIncidentEvents(id)
      if (!events) {
        jsonError(req, res, 'Incidente no encontrado', 404)
        return true
      }
      jsonResponse(req, res, events)
      return true
    }

    if (detailMatch) {
      const id = detailMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID de incidente inválido', 400)
        return true
      }
      const detail = await getIncidentDetail(id)
      if (!detail) {
        jsonError(req, res, 'Incidente no encontrado', 404)
        return true
      }
      jsonResponse(req, res, detail)
      return true
    }

    if (pathname === '/api/intelligence/incidents') {
      const result = await listIncidentsDto({
        status: searchParams.get('status') ?? undefined,
        attention_level: searchParams.get('attention_level') ?? undefined,
        verification_level: searchParams.get('verification_level') ?? undefined,
        domain: searchParams.get('domain') ?? undefined,
        limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      })
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
  if (await rejectIfUnauthenticated(req, res)) return true

  const eventId = match[1]
  if (!UUID_RE.test(eventId)) {
    jsonError(req, res, 'ID de evento inválido', 400)
    return true
  }

  try {
    const result = await getFireEventIncident(eventId)
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
