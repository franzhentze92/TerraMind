import type { IncomingMessage, ServerResponse } from 'node:http'
import { readJsonBody } from '../http/body.js'
import { rejectInvalidUuid } from '../http/route-utils.js'
import { jsonError, jsonResponse } from '../http/json.js'
import {
  authorizeIncidentAccess,
  authorizeMissionAccess,
  authorizeVerificationNeedAccess,
  authorizeVerificationPlanAccess,
} from '../services/authorization/index.js'
import { runOperationalGuard } from '../middleware/operational-guard.js'
import {
  getIncidentVerificationResolution,
  getMissionResolutionContributions,
  getNeedResolution,
  getNeedResolutionHistory,
  getPlanResolutionSummary,
  reEvaluateVerificationNeed,
} from '../services/verification-resolution.service.js'

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

  try {
    if (needReEvaluateMatch && req.method === 'POST') {
      const id = needReEvaluateMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID')) return true
      const body = await readJsonBody<Record<string, unknown>>(req)
      if (!body.idempotency_key) {
        jsonError(req, res, 'idempotency_key es requerido', 400)
        return true
      }
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'verification_plans.view',
          rateLimit: 'reevaluation',
          authorize: (auth) => authorizeVerificationNeedAccess(auth, id),
        },
        async (auth) =>
          reEvaluateVerificationNeed(id, {
            actor_id: auth.userId,
            idempotency_key: String(body.idempotency_key),
          }),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (needResolutionMatch && req.method === 'GET') {
      const id = needResolutionMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID')) return true
      if (pathname.endsWith('/resolution-history')) {
        const result = await runOperationalGuard(
          req,
          res,
          {
            permission: 'verification_plans.view',
            rateLimit: 'default_read',
            authorize: (auth) => authorizeVerificationNeedAccess(auth, id),
          },
          async () => getNeedResolutionHistory(id),
        )
        if (result === null) return true
        jsonResponse(req, res, result)
        return true
      }
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'verification_plans.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeVerificationNeedAccess(auth, id),
        },
        async () => getNeedResolution(id),
      )
      if (result === null) return true
      if (!result) {
        jsonError(req, res, 'Resolución no encontrada', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    if (planSummaryMatch && req.method === 'GET') {
      const id = planSummaryMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de plan')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'verification_plans.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeVerificationPlanAccess(auth, id),
        },
        async () => getPlanResolutionSummary(id),
      )
      if (result === null) return true
      if (!result) {
        jsonError(req, res, 'Plan no encontrado', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    if (incidentResolutionMatch && req.method === 'GET') {
      const id = incidentResolutionMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de incidente')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'verification_plans.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeIncidentAccess(auth, id),
        },
        async () => getIncidentVerificationResolution(id),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (missionContributionsMatch && req.method === 'GET') {
      const id = missionContributionsMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de misión')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'verification_plans.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeMissionAccess(auth, id),
        },
        async () => getMissionResolutionContributions(id),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    jsonError(req, res, 'Method not allowed', 405)
    return true
  } catch (err) {
    jsonError(req, res, err instanceof Error ? err.message : 'Error interno', 400)
    return true
  }
}
