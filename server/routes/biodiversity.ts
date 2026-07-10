import type { IncomingMessage, ServerResponse } from 'node:http'
import { getBiodiversityDashboardService } from '@/modules/biodiversity/biodiversity-dashboard.service'
import { getBiodiversityService } from '@/modules/biodiversity/biodiversity.service'
import { getBiodiversityVisualService } from '@/modules/biodiversity/biodiversity-visual.service'
import { parseBiodiversityDashboardFilters } from '@/modules/biodiversity/dto/biodiversity-dashboard.dto'
import { rejectIfUnauthenticated } from '../middleware/auth.js'
import { rejectIfRateLimited } from '../middleware/rate-limit.js'
import { jsonError, jsonResponse } from '../http/json.js'

const ZONE_CODE_RE = /^[a-z][a-z0-9-]*$/

/**
 * Rutas agregadas de biodiversidad para dashboard y Situación Nacional.
 * No expone ocurrencias individuales ni búsquedas arbitrarias por coordenadas.
 */
export async function handleBiodiversityRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
): Promise<boolean> {
  if (!pathname.startsWith('/api/environment/biodiversity')) return false
  if (req.method !== 'GET') {
    jsonError(req, res, 'Method not allowed', 405)
    return true
  }
  if (rejectIfUnauthenticated(req, res)) return true
  if (rejectIfRateLimited(req, res, { maxRequests: 60, windowMs: 60_000 })) return true

  const dashboard = getBiodiversityDashboardService()
  const biodiversity = getBiodiversityService()
  const visual = getBiodiversityVisualService()

  try {
    if (pathname === '/api/environment/biodiversity/dashboard-summary') {
      const parsed = parseBiodiversityDashboardFilters(searchParams)
      if (!parsed.ok) {
        jsonError(req, res, parsed.error, 400)
        return true
      }
      const summary = await dashboard.getDashboardSummary(parsed.data)
      jsonResponse(req, res, summary)
      return true
    }

    if (pathname === '/api/environment/biodiversity/zones') {
      jsonResponse(req, res, dashboard.listZones())
      return true
    }

    const zoneSummaryMatch = pathname.match(
      /^\/api\/environment\/biodiversity\/zones\/([^/]+)\/summary$/,
    )
    if (zoneSummaryMatch) {
      const zoneCode = zoneSummaryMatch[1]
      if (!ZONE_CODE_RE.test(zoneCode)) {
        jsonError(req, res, 'Código de zona inválido', 400)
        return true
      }
      const parsed = parseBiodiversityDashboardFilters(searchParams)
      if (!parsed.ok) {
        jsonError(req, res, parsed.error, 400)
        return true
      }
      const summary = await dashboard.getZoneSummary(zoneCode, parsed.data)
      if (!summary) {
        jsonError(req, res, 'Zona no encontrada', 404)
        return true
      }
      jsonResponse(req, res, summary)
      return true
    }

    if (pathname === '/api/environment/biodiversity/visual-summary') {
      const parsed = parseBiodiversityDashboardFilters(searchParams)
      if (!parsed.ok) {
        jsonError(req, res, parsed.error, 400)
        return true
      }
      const summary = await visual.getVisualSummary(parsed.data)
      jsonResponse(req, res, summary)
      return true
    }

    const visualDetailMatch = pathname.match(
      /^\/api\/environment\/biodiversity\/visual\/([^/]+)\/([^/]+)$/,
    )
    if (visualDetailMatch) {
      const [, source, occurrenceId] = visualDetailMatch
      if (source !== 'gbif' && source !== 'inaturalist') {
        jsonError(req, res, 'Proveedor inválido', 400)
        return true
      }
      const parsed = parseBiodiversityDashboardFilters(searchParams)
      if (!parsed.ok) {
        jsonError(req, res, parsed.error, 400)
        return true
      }
      const detail = await visual.getVisualDetail(source, occurrenceId, parsed.data)
      if (!detail) {
        jsonError(req, res, 'Observación visual no encontrada', 404)
        return true
      }
      jsonResponse(req, res, detail)
      return true
    }

    if (pathname === '/api/environment/biodiversity/health') {
      const health = await biodiversity.getSystemHealth()
      jsonResponse(req, res, health)
      return true
    }

    jsonError(req, res, 'Not found', 404)
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno'
    jsonError(req, res, message, 500)
    return true
  }
}
