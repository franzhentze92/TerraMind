import type { IncomingMessage, ServerResponse } from 'node:http'
import { readJsonBody } from '../http/body.js'
import { rejectInvalidUuid } from '../http/route-utils.js'
import { jsonError, jsonResponse } from '../http/json.js'
import {
  authorizeEvidenceSubmissionRead,
  authorizeEvidenceValidation,
  authorizeMissionAccess,
} from '../services/authorization/index.js'
import { runOperationalGuard } from '../middleware/operational-guard.js'
import {
  getMissionEvidenceQualitySummary,
  getMissionEvidenceValidations,
  getSubmissionValidation,
  getSubmissionValidationHistory,
  revalidateEvidenceSubmission,
} from '../services/evidence-validation.service.js'

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

  try {
    if (revalidateMatch && req.method === 'POST') {
      const id = revalidateMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID')) return true
      const body = await readJsonBody<Record<string, unknown>>(req)
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'evidence.revalidate',
          rateLimit: 'validation',
          authorize: (auth) => authorizeEvidenceValidation(auth, id),
        },
        async (auth) =>
          revalidateEvidenceSubmission(id, {
            actor_id: auth.userId,
            idempotency_key: body.idempotency_key ? String(body.idempotency_key) : null,
          }),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (validationMatch && req.method === 'GET') {
      const id = validationMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID')) return true
      if (pathname.endsWith('/validation-history')) {
        const result = await runOperationalGuard(
          req,
          res,
          {
            permission: 'evidence.view',
            rateLimit: 'default_read',
            authorize: (auth) => authorizeEvidenceSubmissionRead(auth, id),
          },
          async () => getSubmissionValidationHistory(id),
        )
        if (result === null) return true
        jsonResponse(req, res, result)
        return true
      }
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'evidence.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeEvidenceSubmissionRead(auth, id),
        },
        async () => getSubmissionValidation(id),
      )
      if (result === null) return true
      if (!result) {
        jsonError(req, res, 'Validación no encontrada', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    if (missionValidationsMatch && req.method === 'GET') {
      const id = missionValidationsMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de misión')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'evidence.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeMissionAccess(auth, id),
        },
        async () => getMissionEvidenceValidations(id),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (missionQualityMatch && req.method === 'GET') {
      const id = missionQualityMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de misión')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'evidence.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeMissionAccess(auth, id),
        },
        async () => getMissionEvidenceQualitySummary(id),
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
