import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  getIncidentVerificationNeeds,
  getIncidentVerificationPlan,
  getVerificationPlanDetail,
  listVerificationPlansDto,
} from '../services/verification.service.js'
import {
  authorizeIncidentAccess,
  authorizeVerificationPlanAccess,
} from '../services/authorization/index.js'
import { runOperationalGuard } from '../middleware/operational-guard.js'
import { rejectInvalidUuid } from '../http/route-utils.js'
import { jsonError, jsonResponse } from '../http/json.js'

export async function handleVerificationRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
): Promise<boolean> {
  const incidentPlanMatch = pathname.match(
    /^\/api\/intelligence\/incidents\/([^/]+)\/verification-plan$/,
  )
  const incidentNeedsMatch = pathname.match(
    /^\/api\/intelligence\/incidents\/([^/]+)\/verification-needs$/,
  )
  const isVerificationPlans = pathname.startsWith('/api/intelligence/verification-plans')

  if (!isVerificationPlans && !incidentPlanMatch && !incidentNeedsMatch) return false
  if (req.method !== 'GET') {
    jsonError(req, res, 'Method not allowed', 405)
    return true
  }

  try {
    if (incidentPlanMatch) {
      const id = incidentPlanMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de incidente')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'verification_plans.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeIncidentAccess(auth, id),
        },
        async () => getIncidentVerificationPlan(id),
      )
      if (result === null) return true
      if (!result) {
        jsonError(req, res, 'Plan de verificación no encontrado', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    if (incidentNeedsMatch) {
      const id = incidentNeedsMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de incidente')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'verification_plans.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeIncidentAccess(auth, id),
        },
        async () => getIncidentVerificationNeeds(id),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    const detailMatch = pathname.match(/^\/api\/intelligence\/verification-plans\/([^/]+)$/)
    if (detailMatch) {
      const id = detailMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de plan')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'verification_plans.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeVerificationPlanAccess(auth, id),
        },
        async () => getVerificationPlanDetail(id),
      )
      if (result === null) return true
      if (!result) {
        jsonError(req, res, 'Plan de verificación no encontrado', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    if (pathname === '/api/intelligence/verification-plans') {
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'verification_plans.view', rateLimit: 'default_read' },
        async (auth) =>
          listVerificationPlansDto(
            {
              status: searchParams.get('status') ?? undefined,
              plan_priority: searchParams.get('plan_priority')
                ? Number(searchParams.get('plan_priority'))
                : undefined,
              recommended_method: searchParams.get('recommended_method') ?? undefined,
              requires_field: searchParams.has('requires_field')
                ? searchParams.get('requires_field') === 'true'
                : undefined,
              requires_external: searchParams.has('requires_external')
                ? searchParams.get('requires_external') === 'true'
                : undefined,
              domain: searchParams.get('domain') ?? undefined,
              blocked: searchParams.has('blocked')
                ? searchParams.get('blocked') === 'true'
                : undefined,
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
