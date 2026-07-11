import type { IncomingMessage, ServerResponse } from 'node:http'
import { readJsonBody } from '../http/body.js'
import { rejectInvalidUuid } from '../http/route-utils.js'
import { jsonError, jsonResponse } from '../http/json.js'
import { runOperationalGuard } from '../middleware/operational-guard.js'
import {
  authorizeResponseAssessmentAccess,
  authorizeResponseApproval,
  authorizeResponseActionAccess,
  authorizeResponseDecide,
  authorizeResponseAssess,
  authorizeResponseDecisionAccess,
  authorizeResponseListScope,
  authorizeResponseModify,
  authorizeResponseReject,
  authorizeClosureRecommendationAccess,
} from '../services/authorization/response-access.js'
import {
  approveResponseDecision,
  assessIncidentResponse,
  createDecisionAction,
  createHumanDecision,
  getClosureAssessment,
  getResponseBriefing,
  getResponseDetail,
  getResponseExecutiveSummary,
  getResponseHistory,
  listResponses,
  modifyDecision,
  patchResponseAction,
  rejectResponseDecision,
} from '../services/response-orchestration.service.js'

export async function handleResponseOrchestrationRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
): Promise<boolean> {
  if (!pathname.startsWith('/api/responses')) return false

  const listMatch = pathname === '/api/responses'
  const executiveMatch = pathname === '/api/responses/executive-summary'
  const incidentMatch = pathname.match(/^\/api\/responses\/([^/]+)$/)
  const assessMatch = pathname.match(/^\/api\/responses\/([^/]+)\/assess$/)
  const decisionsMatch = pathname.match(/^\/api\/responses\/([^/]+)\/decisions$/)
  const briefingMatch = pathname.match(/^\/api\/responses\/([^/]+)\/briefing$/)
  const closureMatch = pathname.match(/^\/api\/responses\/([^/]+)\/closure-assessment$/)
  const historyMatch = pathname.match(/^\/api\/responses\/([^/]+)\/history$/)
  const decisionPatchMatch = pathname.match(/^\/api\/responses\/decisions\/([^/]+)$/)
  const decisionApproveMatch = pathname.match(/^\/api\/responses\/decisions\/([^/]+)\/approve$/)
  const decisionRejectMatch = pathname.match(/^\/api\/responses\/decisions\/([^/]+)\/reject$/)
  const decisionActionsMatch = pathname.match(/^\/api\/responses\/decisions\/([^/]+)\/actions$/)
  const actionPatchMatch = pathname.match(/^\/api\/responses\/actions\/([^/]+)$/)

  try {
    if (executiveMatch && req.method === 'GET') {
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'responses.view',
          rateLimit: 'default_read',
          authorize: authorizeResponseListScope,
          auditType: 'responses_executive_summary',
          resourceType: 'response_list',
        },
        async (auth) => getResponseExecutiveSummary(auth.activeOrganizationId),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (listMatch && req.method === 'GET') {
      const filter = searchParams.get('filter') ?? undefined
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'responses.view',
          rateLimit: 'default_read',
          authorize: authorizeResponseListScope,
          auditType: 'responses_list',
          resourceType: 'response_list',
        },
        async (auth) => listResponses(auth.activeOrganizationId, filter),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (assessMatch && req.method === 'POST') {
      const incidentId = assessMatch[1]
      if (rejectInvalidUuid(req, res, incidentId, 'ID de incidente')) return true
      const body = await readJsonBody<{ idempotency_key?: string }>(req)
      if (!body.idempotency_key) {
        jsonError(req, res, 'idempotency_key es requerido', 400)
        return true
      }
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'responses.assess',
          rateLimit: 'reevaluation',
          authorize: (auth) => authorizeResponseAssess(auth, incidentId),
          auditType: 'response_assess',
          resourceType: 'incident',
          resourceId: incidentId,
        },
        async (auth) =>
          assessIncidentResponse(incidentId, auth.activeOrganizationId, {
            idempotency_key: String(body.idempotency_key),
            actor_id: auth.userId,
          }),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (decisionsMatch && req.method === 'POST') {
      const incidentId = decisionsMatch[1]
      if (rejectInvalidUuid(req, res, incidentId, 'ID de incidente')) return true
      const body = await readJsonBody<{ rationale?: string }>(req)
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'responses.decide',
          rateLimit: 'validation',
          authorize: (auth) => authorizeResponseDecide(auth, incidentId),
          auditType: 'response_decision_create',
          resourceType: 'incident',
          resourceId: incidentId,
        },
        async (auth) =>
          createHumanDecision(incidentId, auth.activeOrganizationId, {
            actor_id: auth.userId,
            rationale: body.rationale,
          }),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (decisionApproveMatch && req.method === 'POST') {
      const decisionId = decisionApproveMatch[1]
      if (rejectInvalidUuid(req, res, decisionId, 'ID de decisión')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'responses.approve',
          rateLimit: 'validation',
          authorize: (auth) => authorizeResponseApproval(auth, decisionId),
          auditType: 'response_decision_approve',
          resourceType: 'decision_record',
          resourceId: decisionId,
        },
        async (auth) => approveResponseDecision(decisionId, auth.userId),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (decisionRejectMatch && req.method === 'POST') {
      const decisionId = decisionRejectMatch[1]
      if (rejectInvalidUuid(req, res, decisionId, 'ID de decisión')) return true
      const body = await readJsonBody<{ rationale?: string }>(req)
      if (!body.rationale?.trim()) {
        jsonError(req, res, 'rationale es requerido', 400)
        return true
      }
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'responses.reject',
          rateLimit: 'validation',
          authorize: (auth) => authorizeResponseReject(auth, decisionId),
          auditType: 'response_decision_reject',
          resourceType: 'decision_record',
          resourceId: decisionId,
        },
        async (auth) => rejectResponseDecision(decisionId, auth.userId, String(body.rationale)),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (decisionPatchMatch && req.method === 'PATCH') {
      const decisionId = decisionPatchMatch[1]
      if (rejectInvalidUuid(req, res, decisionId, 'ID de decisión')) return true
      const body = await readJsonBody<{
        modified_decision?: string
        rationale?: string
        updated_at?: string
      }>(req)
      if (!body.modified_decision || !body.rationale?.trim()) {
        jsonError(req, res, 'modified_decision y rationale son requeridos', 400)
        return true
      }
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'responses.modify',
          rateLimit: 'validation',
          authorize: (auth) => authorizeResponseModify(auth, decisionId),
          auditType: 'response_decision_modify',
          resourceType: 'decision_record',
          resourceId: decisionId,
        },
        async (auth) =>
          modifyDecision(decisionId, {
            modified_decision: String(body.modified_decision),
            rationale: String(body.rationale),
            actor_id: auth.userId,
            updated_at: body.updated_at,
          }),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (decisionActionsMatch && req.method === 'POST') {
      const decisionId = decisionActionsMatch[1]
      if (rejectInvalidUuid(req, res, decisionId, 'ID de decisión')) return true
      const body = await readJsonBody<{
        action_type?: string
        owner_id?: string | null
        priority?: number
        due_at?: string | null
      }>(req)
      if (!body.action_type) {
        jsonError(req, res, 'action_type es requerido', 400)
        return true
      }
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'response_actions.create',
          rateLimit: 'validation',
          authorize: (auth) => authorizeResponseDecisionAccess(auth, decisionId, 'response_actions.create'),
          auditType: 'response_action_create',
          resourceType: 'decision_record',
          resourceId: decisionId,
        },
        async (auth) =>
          createDecisionAction(decisionId, {
            action_type: String(body.action_type),
            owner_id: body.owner_id ?? null,
            priority: body.priority,
            due_at: body.due_at ?? null,
            actor_id: auth.userId,
          }),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (actionPatchMatch && req.method === 'PATCH') {
      const actionId = actionPatchMatch[1]
      if (rejectInvalidUuid(req, res, actionId, 'ID de acción')) return true
      const body = await readJsonBody<Record<string, unknown>>(req)
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'response_actions.execute',
          rateLimit: 'validation',
          authorize: (auth) => authorizeResponseActionAccess(auth, actionId),
          auditType: 'response_action_update',
          resourceType: 'response_action',
          resourceId: actionId,
        },
        async (auth) => patchResponseAction(actionId, body, auth.userId),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (briefingMatch && req.method === 'GET') {
      const incidentId = briefingMatch[1]
      if (rejectInvalidUuid(req, res, incidentId, 'ID de incidente')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'responses.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeResponseAssessmentAccess(auth, incidentId),
          auditType: 'response_briefing',
          resourceType: 'incident',
          resourceId: incidentId,
        },
        async (auth) => getResponseBriefing(incidentId, auth.activeOrganizationId),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (closureMatch && req.method === 'GET') {
      const incidentId = closureMatch[1]
      if (rejectInvalidUuid(req, res, incidentId, 'ID de incidente')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'incident_closure.recommend',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeClosureRecommendationAccess(auth, incidentId),
          auditType: 'response_closure_assessment',
          resourceType: 'incident',
          resourceId: incidentId,
        },
        async (auth) => getClosureAssessment(incidentId, auth.activeOrganizationId),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (historyMatch && req.method === 'GET') {
      const incidentId = historyMatch[1]
      if (rejectInvalidUuid(req, res, incidentId, 'ID de incidente')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'responses.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeResponseAssessmentAccess(auth, incidentId),
          auditType: 'response_history',
          resourceType: 'incident',
          resourceId: incidentId,
        },
        async (auth) => getResponseHistory(incidentId, auth.activeOrganizationId),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (incidentMatch && req.method === 'GET') {
      const incidentId = incidentMatch[1]
      if (rejectInvalidUuid(req, res, incidentId, 'ID de incidente')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'responses.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeResponseAssessmentAccess(auth, incidentId),
          auditType: 'response_detail',
          resourceType: 'incident',
          resourceId: incidentId,
        },
        async (auth) => getResponseDetail(incidentId, auth.activeOrganizationId),
      )
      if (result === null) return true
      if (!result) {
        jsonError(req, res, 'Respuesta no encontrada', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    jsonError(req, res, 'Method not allowed', 405)
    return true
  } catch (err) {
    jsonError(req, res, err instanceof Error ? err.message : 'Error interno', 500)
    return true
  }
}
