import type { IncomingMessage, ServerResponse } from 'node:http'
import { rejectIfUnauthenticated } from '../middleware/auth.js'
import { readJsonBody } from '../http/body.js'
import { jsonError, jsonResponse } from '../http/json.js'
import {
  getIncidentVerificationResolution,
  getMissionResolutionContributions,
  getNeedResolution,
  getNeedResolutionHistory,
  getPlanResolutionSummary,
  reEvaluateVerificationNeed,
} from '../services/verification-resolution.service.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function handleVerificationResolutionRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  const needResolutionMatch = pathname.match(
    /^\/api\/intelligence\/verification-needs\/([^/]+)\/resolution(?:-history)?$/,
  )
  const needReEvaluateMatch = pathname.match(
    /^\/api\/intelligence\/verification-needs\/([^/]+)\/re-evaluate$/,
  )
  const planSummaryMatch = pathname.match(
    /^\/api\/intelligence\/verification-plans\/([^/]+)\/resolution-summary$/,
  )
  const incidentResolutionMatch = pathname.match(
    /^\/api\/intelligence\/incidents\/([^/]+)\/verification-resolution$/,
  )
  const missionContributionsMatch = pathname.match(
    /^\/api\/operations\/missions\/([^/]+)\/resolution-contributions$/,
  )

  const isRoute =
    needResolutionMatch ||
    needReEvaluateMatch ||
    planSummaryMatch ||
    incidentResolutionMatch ||
    missionContributionsMatch
  if (!isRoute) return false
  if (rejectIfUnauthenticated(req, res)) return true

  try {
    if (needReEvaluateMatch && req.method === 'POST') {
      const id = needReEvaluateMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID inválido', 400)
        return true
      }
      const body = await readJsonBody<Record<string, unknown>>(req)
      if (!body.idempotency_key) {
        jsonError(req, res, 'idempotency_key es requerido', 400)
        return true
      }
      jsonResponse(
        req,
        res,
        await reEvaluateVerificationNeed(id, {
          actor_id: body.actor_id ? String(body.actor_id) : null,
          idempotency_key: String(body.idempotency_key),
        }),
      )
      return true
    }

    if (needResolutionMatch && req.method === 'GET') {
      const id = needResolutionMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID inválido', 400)
        return true
      }
      if (pathname.endsWith('/resolution-history')) {
        jsonResponse(req, res, await getNeedResolutionHistory(id))
        return true
      }
      const detail = await getNeedResolution(id)
      if (!detail) {
        jsonError(req, res, 'Resolución no encontrada', 404)
        return true
      }
      jsonResponse(req, res, detail)
      return true
    }

    if (planSummaryMatch && req.method === 'GET') {
      const id = planSummaryMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID de plan inválido', 400)
        return true
      }
      const summary = await getPlanResolutionSummary(id)
      if (!summary) {
        jsonError(req, res, 'Plan no encontrado', 404)
        return true
      }
      jsonResponse(req, res, summary)
      return true
    }

    if (incidentResolutionMatch && req.method === 'GET') {
      const id = incidentResolutionMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID de incidente inválido', 400)
        return true
      }
      jsonResponse(req, res, await getIncidentVerificationResolution(id))
      return true
    }

    if (missionContributionsMatch && req.method === 'GET') {
      const id = missionContributionsMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID de misión inválido', 400)
        return true
      }
      jsonResponse(req, res, await getMissionResolutionContributions(id))
      return true
    }

    jsonError(req, res, 'Method not allowed', 405)
    return true
  } catch (err) {
    jsonError(req, res, err instanceof Error ? err.message : 'Error interno', 400)
    return true
  }
}
