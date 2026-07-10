import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  getIncidentVerificationNeeds,
  getIncidentVerificationPlan,
  getVerificationPlanDetail,
  listVerificationPlansDto,
} from '../services/verification.service.js'
import { rejectIfUnauthenticated } from '../middleware/auth.js'
import { jsonError, jsonResponse } from '../http/json.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
  if (await rejectIfUnauthenticated(req, res)) return true

  try {
    if (incidentPlanMatch) {
      const id = incidentPlanMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID de incidente inválido', 400)
        return true
      }
      const plan = await getIncidentVerificationPlan(id)
      if (!plan) {
        jsonError(req, res, 'Plan de verificación no encontrado', 404)
        return true
      }
      jsonResponse(req, res, plan)
      return true
    }

    if (incidentNeedsMatch) {
      const id = incidentNeedsMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID de incidente inválido', 400)
        return true
      }
      const needs = await getIncidentVerificationNeeds(id)
      jsonResponse(req, res, needs)
      return true
    }

    const detailMatch = pathname.match(/^\/api\/intelligence\/verification-plans\/([^/]+)$/)
    if (detailMatch) {
      const id = detailMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID de plan inválido', 400)
        return true
      }
      const detail = await getVerificationPlanDetail(id)
      if (!detail) {
        jsonError(req, res, 'Plan de verificación no encontrado', 404)
        return true
      }
      jsonResponse(req, res, detail)
      return true
    }

    if (pathname === '/api/intelligence/verification-plans') {
      const result = await listVerificationPlansDto({
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
