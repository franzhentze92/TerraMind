import type { IncomingMessage, ServerResponse } from 'node:http'
import { rejectIfUnauthenticated } from '../middleware/auth.js'
import { readJsonBody } from '../http/body.js'
import { jsonError, jsonResponse } from '../http/json.js'
import {
  getMissionEvidenceQualitySummary,
  getMissionEvidenceValidations,
  getSubmissionValidation,
  getSubmissionValidationHistory,
  revalidateEvidenceSubmission,
} from '../services/evidence-validation.service.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function handleEvidenceValidationRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  const validationMatch = pathname.match(
    /^\/api\/operations\/evidence-submissions\/([^/]+)\/validation(?:-history)?$/,
  )
  const revalidateMatch = pathname.match(
    /^\/api\/operations\/evidence-submissions\/([^/]+)\/revalidate$/,
  )
  const missionValidationsMatch = pathname.match(
    /^\/api\/operations\/missions\/([^/]+)\/evidence-validations$/,
  )
  const missionQualityMatch = pathname.match(
    /^\/api\/operations\/missions\/([^/]+)\/evidence-quality-summary$/,
  )

  const isRoute =
    validationMatch || revalidateMatch || missionValidationsMatch || missionQualityMatch
  if (!isRoute) return false
  if (await rejectIfUnauthenticated(req, res)) return true

  try {
    if (revalidateMatch && req.method === 'POST') {
      const id = revalidateMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID inválido', 400)
        return true
      }
      const body = await readJsonBody<Record<string, unknown>>(req)
      jsonResponse(
        req,
        res,
        await revalidateEvidenceSubmission(id, {
          actor_id: body.actor_id ? String(body.actor_id) : null,
          idempotency_key: body.idempotency_key ? String(body.idempotency_key) : null,
        }),
      )
      return true
    }

    if (validationMatch && req.method === 'GET') {
      const id = validationMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID inválido', 400)
        return true
      }
      if (pathname.endsWith('/validation-history')) {
        jsonResponse(req, res, await getSubmissionValidationHistory(id))
        return true
      }
      const detail = await getSubmissionValidation(id)
      if (!detail) {
        jsonError(req, res, 'Validación no encontrada', 404)
        return true
      }
      jsonResponse(req, res, detail)
      return true
    }

    if (missionValidationsMatch && req.method === 'GET') {
      const id = missionValidationsMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID de misión inválido', 400)
        return true
      }
      jsonResponse(req, res, await getMissionEvidenceValidations(id))
      return true
    }

    if (missionQualityMatch && req.method === 'GET') {
      const id = missionQualityMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID de misión inválido', 400)
        return true
      }
      jsonResponse(req, res, await getMissionEvidenceQualitySummary(id))
      return true
    }

    jsonError(req, res, 'Method not allowed', 405)
    return true
  } catch (err) {
    jsonError(req, res, err instanceof Error ? err.message : 'Error interno', 400)
    return true
  }
}
