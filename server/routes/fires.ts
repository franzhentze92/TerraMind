import type { IncomingMessage, ServerResponse } from 'node:http'
import { parseFireEventsQuery } from '@/modules/fires/api/fire-api.validation'
import { listFireEvents } from '../services/fire-events.service.js'
import {
  getFireDetectionsGeoJson,
  getFireEventsGeoJson,
} from '../services/fire-geojson.service.js'
import {
  getFireEventDetail,
  listFireDepartments,
} from '../services/fire-event-detail.service.js'
import { getFirePipelineHealth } from '../services/fire-pipeline-health.service.js'
import { getFireSummary } from '../services/fire-summary.service.js'
import { rejectIfUnauthenticated } from '../middleware/auth.js'
import { jsonError, jsonResponse } from '../http/json.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function handleFireRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
): Promise<boolean> {
  if (!pathname.startsWith('/api/environment/fires')) return false
  if (req.method !== 'GET') {
    jsonError(req, res, 'Method not allowed', 405)
    return true
  }
  if (rejectIfUnauthenticated(req, res)) return true

  try {
    if (pathname === '/api/environment/fires/summary') {
      const windowHours = Number(searchParams.get('window_hours') ?? 48)
      const hours = Number.isFinite(windowHours) && windowHours > 0 ? windowHours : 48
      const summary = await getFireSummary(hours)
      jsonResponse(req, res, summary)
      return true
    }

    if (pathname === '/api/environment/fires/departments') {
      const departments = await listFireDepartments()
      jsonResponse(req, res, { items: departments, generated_at: new Date().toISOString() })
      return true
    }

    if (pathname === '/api/environment/fires/events') {
      const parsed = parseFireEventsQuery(searchParams)
      if (!parsed.ok) {
        jsonError(req, res, parsed.error, 400)
        return true
      }
      const events = await listFireEvents(parsed.data)
      jsonResponse(req, res, events)
      return true
    }

    if (pathname === '/api/environment/fires/geojson') {
      const parsed = parseFireEventsQuery(searchParams)
      if (!parsed.ok) {
        jsonError(req, res, parsed.error, 400)
        return true
      }
      const geo = await getFireEventsGeoJson({ ...parsed.data, offset: 0, limit: 100 })
      jsonResponse(req, res, geo)
      return true
    }

    if (pathname === '/api/environment/fires/detections/geojson') {
      const parsed = parseFireEventsQuery(searchParams)
      if (!parsed.ok) {
        jsonError(req, res, parsed.error, 400)
        return true
      }
      const geo = await getFireDetectionsGeoJson({ ...parsed.data, offset: 0, limit: 100 })
      jsonResponse(req, res, geo)
      return true
    }

    if (pathname === '/api/environment/fires/pipeline/health') {
      const health = await getFirePipelineHealth()
      jsonResponse(req, res, health)
      return true
    }

    const detailMatch = pathname.match(/^\/api\/environment\/fires\/events\/([^/]+)$/)
    if (detailMatch) {
      const eventId = detailMatch[1]
      if (!UUID_RE.test(eventId)) {
        jsonError(req, res, 'ID de evento inválido', 400)
        return true
      }
      const detail = await getFireEventDetail(eventId)
      if (!detail) {
        jsonError(req, res, 'Evento no encontrado', 404)
        return true
      }
      jsonResponse(req, res, detail)
      return true
    }

    jsonError(req, res, 'Not found', 404)
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno'
    jsonResponse(req, res, { error: 'No se pudo obtener información de incendios' }, 500)
    console.error('[fires-api]', message)
    return true
  }
}
