import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  getIncidentMissions,
  getMissionDetail,
  getMissionEvidenceDto,
  getMissionTasksDto,
  getVerificationPlanMissions,
  listMissionsDto,
} from '../services/missions.service.js'
import {
  executeMissionWorkflow,
  getAssigneeMissionsDto,
  getMissionAssignmentsDto,
} from '../services/mission-workflow.service.js'
import {
  authorizeAssigneeListAccess,
  authorizeIncidentAccess,
  authorizeMissionAccess,
  authorizeMissionWorkflowAction,
  authorizeVerificationPlanAccess,
} from '../services/authorization/index.js'
import { assertBodyOrganizationMatchesActive } from '../auth/payload-tenant-guard.js'
import { runOperationalGuard } from '../middleware/operational-guard.js'
import { readJsonBody } from '../http/body.js'
import { rejectInvalidUuid } from '../http/route-utils.js'
import { jsonError, jsonResponse } from '../http/json.js'

const WORKFLOW_ACTIONS = [
  'assign',
  'accept',
  'decline',
  'start',
  'block',
  'resume',
  'reassign',
  'complete',
  'cancel',
] as const

type WorkflowAssigneeType = 'user' | 'team' | 'organization' | 'external_actor'

async function handleWorkflowPost(
  req: IncomingMessage,
  res: ServerResponse,
  missionId: string,
  action: (typeof WORKFLOW_ACTIONS)[number],
): Promise<boolean> {
  const body = await readJsonBody<Record<string, unknown>>(req)
  const result = await runOperationalGuard(
    req,
    res,
    {
      permission: 'missions.view',
      authorize: (auth) => authorizeMissionWorkflowAction(auth, missionId, action),
      auditType: `mission_${action}`,
      resourceType: 'mission',
      resourceId: missionId,
    },
    async (auth) => {
      await assertBodyOrganizationMatchesActive(
        auth,
        body.organization_id ? String(body.organization_id) : null,
      )
      return executeMissionWorkflow(
        missionId,
        {
          action,
          assignee_type: body.assignee_type as WorkflowAssigneeType | undefined,
          assignee_id: body.assignee_id ? String(body.assignee_id) : undefined,
          organization_id: auth.activeOrganizationId,
          reason: body.reason ? String(body.reason) : undefined,
          idempotency_key: body.idempotency_key ? String(body.idempotency_key) : undefined,
          override_compatibility: Boolean(body.override_compatibility),
          explicit_inconclusive: Boolean(body.explicit_inconclusive),
        },
        auth,
      )
    },
  )
  if (result === null) return true
  if (!result.ok) {
    jsonError(req, res, result.reasons.join('; '), 400)
    return true
  }
  jsonResponse(req, res, result)
  return true
}

export async function handleMissionsRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
): Promise<boolean> {
  const incidentMissionsMatch = pathname.match(
    /^\/api\/intelligence\/incidents\/([^/]+)\/missions$/,
  )
  const planMissionsMatch = pathname.match(
    /^\/api\/intelligence\/verification-plans\/([^/]+)\/missions$/,
  )
  const assigneeMissionsMatch = pathname.match(
    /^\/api\/operations\/assignees\/([^/]+)\/([^/]+)\/missions$/,
  )
  const isOperationsMissions = pathname.startsWith('/api/operations/missions')
  const isOperationsAssignees = pathname.startsWith('/api/operations/assignees')

  if (!isOperationsMissions && !incidentMissionsMatch && !planMissionsMatch && !isOperationsAssignees) {
    return false
  }

  try {
    for (const action of WORKFLOW_ACTIONS) {
      const match = pathname.match(new RegExp(`^/api/operations/missions/([^/]+)/${action}$`))
      if (match) {
        if (req.method !== 'POST') {
          jsonError(req, res, 'Method not allowed', 405)
          return true
        }
        const id = match[1]
        if (rejectInvalidUuid(req, res, id, 'ID de misión')) return true
        return handleWorkflowPost(req, res, id, action)
      }
    }

    const assignmentsMatch = pathname.match(/^\/api\/operations\/missions\/([^/]+)\/assignments$/)
    if (assignmentsMatch) {
      if (req.method !== 'GET') {
        jsonError(req, res, 'Method not allowed', 405)
        return true
      }
      const id = assignmentsMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de misión')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'missions.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeMissionAccess(auth, id),
        },
        async () => getMissionAssignmentsDto(id),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (assigneeMissionsMatch) {
      if (req.method !== 'GET') {
        jsonError(req, res, 'Method not allowed', 405)
        return true
      }
      const [, type, id] = assigneeMissionsMatch
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'missions.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeAssigneeListAccess(auth, type, id),
        },
        async () => getAssigneeMissionsDto(type, id),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (req.method !== 'GET') {
      jsonError(req, res, 'Method not allowed', 405)
      return true
    }

    if (incidentMissionsMatch) {
      const id = incidentMissionsMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de incidente')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'missions.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeIncidentAccess(auth, id),
        },
        async (auth) => getIncidentMissions(id, auth),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (planMissionsMatch) {
      const id = planMissionsMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de plan')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'missions.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeVerificationPlanAccess(auth, id),
        },
        async (auth) => getVerificationPlanMissions(id, auth),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    const tasksMatch = pathname.match(/^\/api\/operations\/missions\/([^/]+)\/tasks$/)
    const evidenceMatch = pathname.match(
      /^\/api\/operations\/missions\/([^/]+)\/evidence-requirements$/,
    )
    const detailMatch = pathname.match(/^\/api\/operations\/missions\/([^/]+)$/)

    if (tasksMatch) {
      const id = tasksMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de misión')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'missions.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeMissionAccess(auth, id),
        },
        async () => getMissionTasksDto(id),
      )
      if (result === null) return true
      if (!result) {
        jsonError(req, res, 'Misión no encontrada', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    if (evidenceMatch) {
      const id = evidenceMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de misión')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'evidence.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeMissionAccess(auth, id),
        },
        async () => getMissionEvidenceDto(id),
      )
      if (result === null) return true
      if (!result) {
        jsonError(req, res, 'Misión no encontrada', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    if (detailMatch) {
      const id = detailMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de misión')) return true
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'missions.view',
          rateLimit: 'default_read',
          authorize: (auth) => authorizeMissionAccess(auth, id),
        },
        async () => getMissionDetail(id),
      )
      if (result === null) return true
      if (!result) {
        jsonError(req, res, 'Misión no encontrada', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    if (pathname === '/api/operations/missions') {
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'missions.view', rateLimit: 'default_read' },
        async (auth) =>
          listMissionsDto(
            {
              status: searchParams.get('status') ?? undefined,
              incident_id: searchParams.get('incident_id') ?? undefined,
              limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
              include_demo: searchParams.get('include_demo') === 'true',
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
