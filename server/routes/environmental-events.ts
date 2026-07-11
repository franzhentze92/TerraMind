/**
 * Environmental Event Framework — generic read routes (server).
 *
 * GET /api/environmental-events         list (canonical model)
 * GET /api/environmental-events/types   per-type summaries
 * GET /api/environmental-events/:id     single canonical event
 *
 * Auth, permissions, rate limiting and tenant model mirror the thermal routes
 * exactly (national scope, `incidents.view`). Legacy `/api/environment/fires/*`
 * routes keep working untouched.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { runOperationalGuard } from '../middleware/operational-guard.js'
import { rejectInvalidUuid } from '../http/route-utils.js'
import { jsonError, jsonResponse } from '../http/json.js'
import {
  isEnvironmentalEventType,
  isEnvironmentalEventStatus,
} from '@/modules/environmental-events/types/taxonomy'
import type { EnvironmentalEventQuery } from '@/modules/environmental-events/types/environmental-event.types'
import { environmentalEventRegistry } from '@/modules/environmental-events/registry/event-type-registry'
import {
  getEnvironmentalEventById,
  getEnvironmentalEventTypeSummaries,
  listEnvironmentalEvents,
} from '../services/environmental-events.service.js'

function parseQuery(
  searchParams: URLSearchParams,
): { ok: true; data: EnvironmentalEventQuery } | { ok: false; error: string } {
  const query: EnvironmentalEventQuery = {}

  const type = searchParams.get('type')
  if (type) {
    if (!isEnvironmentalEventType(type)) return { ok: false, error: `Tipo no válido: ${type}` }
    if (!environmentalEventRegistry.isEnabled(type)) {
      return { ok: false, error: `Tipo no soportado todavía: ${type}` }
    }
    query.type = type
  }

  const status = searchParams.get('status')
  if (status) {
    if (!isEnvironmentalEventStatus(status)) {
      return { ok: false, error: `Estado no válido: ${status}` }
    }
    query.status = status
  }

  const since = searchParams.get('since')
  if (since) query.since = since
  const until = searchParams.get('until')
  if (until) query.until = until
  const dept = searchParams.get('department_code')
  if (dept) query.departmentCode = dept

  const page = searchParams.get('page')
  if (page) {
    const n = Number(page)
    if (!Number.isFinite(n) || n < 1) return { ok: false, error: 'page inválido' }
    query.page = n
  }
  const limit = searchParams.get('limit')
  if (limit) {
    const n = Number(limit)
    if (!Number.isFinite(n) || n < 1 || n > 100) return { ok: false, error: 'limit inválido (1-100)' }
    query.limit = n
  }

  const bounds = searchParams.get('bounds')
  if (bounds) {
    const parts = bounds.split(',').map(Number)
    if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p))) {
      return { ok: false, error: 'bounds inválido (w,s,e,n)' }
    }
    query.bounds = parts as [number, number, number, number]
  }

  return { ok: true, data: query }
}

export async function handleEnvironmentalEventsRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
): Promise<boolean> {
  if (!pathname.startsWith('/api/environmental-events')) return false
  if (req.method !== 'GET') {
    jsonError(req, res, 'Method not allowed', 405)
    return true
  }

  try {
    if (pathname === '/api/environmental-events/types') {
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'incidents.view', rateLimit: 'default_read' },
        async () => ({
          items: await getEnvironmentalEventTypeSummaries(),
          registered_types: environmentalEventRegistry.enabledTypes(),
          generated_at: new Date().toISOString(),
        }),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (pathname === '/api/environmental-events') {
      const parsed = parseQuery(searchParams)
      if (!parsed.ok) {
        jsonError(req, res, parsed.error, 400)
        return true
      }
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'incidents.view', rateLimit: 'default_read' },
        async () => listEnvironmentalEvents(parsed.data),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    const detailMatch = pathname.match(/^\/api\/environmental-events\/([^/]+)$/)
    if (detailMatch) {
      const id = detailMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de evento')) return true
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'incidents.view', rateLimit: 'default_read' },
        async () => getEnvironmentalEventById(id),
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
