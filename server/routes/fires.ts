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
import { runOperationalGuard } from '../middleware/operational-guard.js'
import { rejectInvalidUuid } from '../http/route-utils.js'
import { jsonError, jsonResponse } from '../http/json.js'

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

  try {
    if (pathname === '/api/environment/fires/summary') {
      const windowHours = Number(searchParams.get('window_hours') ?? 48)
      const hours = Number.isFinite(windowHours) && windowHours > 0 ? windowHours : 48
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'incidents.view', rateLimit: 'default_read' },
        async () => getFireSummary(hours),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (pathname === '/api/environment/fires/departments') {
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'incidents.view', rateLimit: 'default_read' },
        async () => ({ items: await listFireDepartments(), generated_at: new Date().toISOString() }),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (pathname === '/api/environment/fires/events') {
      const parsed = parseFireEventsQuery(searchParams)
      if (!parsed.ok) {
        jsonError(req, res, parsed.error, 400)
        return true
      }
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'incidents.view', rateLimit: 'default_read' },
        async () => listFireEvents(parsed.data),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (pathname === '/api/environment/fires/geojson') {
      const parsed = parseFireEventsQuery(searchParams)
      if (!parsed.ok) {
        jsonError(req, res, parsed.error, 400)
        return true
      }
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'incidents.view', rateLimit: 'default_read' },
        async () => getFireEventsGeoJson({ ...parsed.data, offset: 0, limit: 100 }),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (pathname === '/api/environment/fires/detections/geojson') {
      const parsed = parseFireEventsQuery(searchParams)
      if (!parsed.ok) {
        jsonError(req, res, parsed.error, 400)
        return true
      }
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'incidents.view', rateLimit: 'default_read' },
        async () => getFireDetectionsGeoJson({ ...parsed.data, offset: 0, limit: 100 }),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (pathname === '/api/environment/fires/pipeline/health') {
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'incidents.view', rateLimit: 'default_read' },
        async () => getFirePipelineHealth(),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    const detailMatch = pathname.match(/^\/api\/environment\/fires\/events\/([^/]+)$/)
    if (detailMatch) {
      const id = detailMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de evento')) return true
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'incidents.view', rateLimit: 'default_read' },
        async () => getFireEventDetail(id),
      )
      if (result === null) return true
      if (!result) {
        jsonError(req, res, 'Evento no encontrado', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    return false
  } catch (err) {
    jsonError(req, res, err instanceof Error ? err.message : 'Error interno', 500)
    return true
  }
}
