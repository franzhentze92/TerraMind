import type { IncomingMessage, ServerResponse } from 'node:http'
import { rejectIfUnauthenticated } from '../middleware/auth.js'
import { jsonError, jsonResponse } from '../http/json.js'
import {
  getClimateHealthForApi,
  getClimateHourlyForApi,
  getClimateSnapshotForApi,
} from '../services/climate-api.service.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function handleClimateRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
): Promise<boolean> {
  if (!pathname.startsWith('/api/environment/climate')) return false
  if (req.method !== 'GET') {
    jsonError(req, res, 'Method not allowed', 405)
    return true
  }
  if (rejectIfUnauthenticated(req, res)) return true

  try {
    if (pathname === '/api/environment/climate/health') {
      const health = await getClimateHealthForApi()
      jsonResponse(req, res, health)
      return true
    }

    const snapshotMatch = pathname.match(
      /^\/api\/environment\/climate\/locations\/([^/]+)\/snapshot$/,
    )
    if (snapshotMatch) {
      const locationId = snapshotMatch[1]
      if (!UUID_RE.test(locationId)) {
        jsonError(req, res, 'location id inválido', 400)
        return true
      }
      const snapshot = await getClimateSnapshotForApi(locationId)
      jsonResponse(req, res, snapshot)
      return true
    }

    const hourlyMatch = pathname.match(
      /^\/api\/environment\/climate\/locations\/([^/]+)\/hourly$/,
    )
    if (hourlyMatch) {
      const locationId = hourlyMatch[1]
      if (!UUID_RE.test(locationId)) {
        jsonError(req, res, 'location id inválido', 400)
        return true
      }
      const hours = Number(searchParams.get('hours') ?? 72)
      const hourly = await getClimateHourlyForApi(locationId, hours)
      jsonResponse(req, res, hourly)
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
