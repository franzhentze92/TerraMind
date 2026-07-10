import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  getEntityLifecycle,
  getEntityLifecycleTransitions,
} from '../services/lifecycle.service.js'
import { rejectIfUnauthenticated } from '../middleware/auth.js'
import { jsonError, jsonResponse } from '../http/json.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function handleLifecycleRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (!pathname.startsWith('/api/intelligence/events/')) return false
  if (req.method !== 'GET') {
    jsonError(req, res, 'Method not allowed', 405)
    return true
  }
  if (await rejectIfUnauthenticated(req, res)) return true

  const lifecycleMatch = pathname.match(
    /^\/api\/intelligence\/events\/([^/]+)\/([^/]+)\/lifecycle$/,
  )
  const transitionsMatch = pathname.match(
    /^\/api\/intelligence\/events\/([^/]+)\/([^/]+)\/transitions$/,
  )

  try {
    if (lifecycleMatch) {
      const [, entityType, entityId] = lifecycleMatch
      if (!UUID_RE.test(entityId)) {
        jsonError(req, res, 'ID de entidad inválido', 400)
        return true
      }
      const summary = await getEntityLifecycle(entityType, entityId)
      if (!summary) {
        jsonError(req, res, 'Entidad no encontrada', 404)
        return true
      }
      jsonResponse(req, res, summary)
      return true
    }

    if (transitionsMatch) {
      const [, entityType, entityId] = transitionsMatch
      if (!UUID_RE.test(entityId)) {
        jsonError(req, res, 'ID de entidad inválido', 400)
        return true
      }
      const transitions = await getEntityLifecycleTransitions(entityType, entityId)
      jsonResponse(req, res, transitions)
      return true
    }

    return false
  } catch (err) {
    jsonError(req, res, err instanceof Error ? err.message : 'Error interno', 500)
    return true
  }
}
