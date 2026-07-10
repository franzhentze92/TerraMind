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
import { rejectIfUnauthenticated } from '../middleware/auth.js'
import { readJsonBody } from '../http/body.js'
import { jsonError, jsonResponse } from '../http/json.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

async function handleWorkflowPost(
  req: IncomingMessage,
  res: ServerResponse,
  missionId: string,
  action: (typeof WORKFLOW_ACTIONS)[number],
): Promise<void> {
  const body = await readJsonBody<Record<string, unknown>>(req)
  try {
    const result = await executeMissionWorkflow(missionId, {
      action,
      assignee_type: body.assignee_type as WorkflowAssigneeType | undefined,
      assignee_id: body.assignee_id ? String(body.assignee_id) : undefined,
      organization_id: body.organization_id ? String(body.organization_id) : undefined,
      reason: body.reason ? String(body.reason) : undefined,
      idempotency_key: body.idempotency_key ? String(body.idempotency_key) : undefined,
      override_compatibility: Boolean(body.override_compatibility),
      explicit_inconclusive: Boolean(body.explicit_inconclusive),
      actor_id: body.actor_id ? String(body.actor_id) : undefined,
    })
    if (!result.ok) {
      jsonError(req, res, result.reasons.join('; '), 400)
      return
    }
    jsonResponse(req, res, result)
  } catch (err) {
    jsonError(req, res, err instanceof Error ? err.message : 'Error de workflow', 400)
  }
}

type WorkflowAssigneeType = 'user' | 'team' | 'organization' | 'external_actor'

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
  if (rejectIfUnauthenticated(req, res)) return true

  try {
    for (const action of WORKFLOW_ACTIONS) {
      const match = pathname.match(new RegExp(`^/api/operations/missions/([^/]+)/${action}$`))
      if (match) {
        if (req.method !== 'POST') {
          jsonError(req, res, 'Method not allowed', 405)
          return true
        }
        const id = match[1]
        if (!UUID_RE.test(id)) {
          jsonError(req, res, 'ID de misión inválido', 400)
          return true
        }
        await handleWorkflowPost(req, res, id, action)
        return true
      }
    }

    const assignmentsMatch = pathname.match(/^\/api\/operations\/missions\/([^/]+)\/assignments$/)
    if (assignmentsMatch) {
      if (req.method !== 'GET') {
        jsonError(req, res, 'Method not allowed', 405)
        return true
      }
      const id = assignmentsMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID de misión inválido', 400)
        return true
      }
      jsonResponse(req, res, await getMissionAssignmentsDto(id))
      return true
    }

    if (assigneeMissionsMatch) {
      if (req.method !== 'GET') {
        jsonError(req, res, 'Method not allowed', 405)
        return true
      }
      const [, type, id] = assigneeMissionsMatch
      jsonResponse(req, res, await getAssigneeMissionsDto(type, id))
      return true
    }

    if (req.method !== 'GET') {
      jsonError(req, res, 'Method not allowed', 405)
      return true
    }

    if (incidentMissionsMatch) {
      const id = incidentMissionsMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID de incidente inválido', 400)
        return true
      }
      jsonResponse(req, res, await getIncidentMissions(id))
      return true
    }

    if (planMissionsMatch) {
      const id = planMissionsMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID de plan inválido', 400)
        return true
      }
      jsonResponse(req, res, await getVerificationPlanMissions(id))
      return true
    }

    const tasksMatch = pathname.match(/^\/api\/operations\/missions\/([^/]+)\/tasks$/)
    const evidenceMatch = pathname.match(
      /^\/api\/operations\/missions\/([^/]+)\/evidence-requirements$/,
    )
    const detailMatch = pathname.match(/^\/api\/operations\/missions\/([^/]+)$/)

    if (tasksMatch) {
      const id = tasksMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID de misión inválido', 400)
        return true
      }
      const tasks = await getMissionTasksDto(id)
      if (!tasks) {
        jsonError(req, res, 'Misión no encontrada', 404)
        return true
      }
      jsonResponse(req, res, tasks)
      return true
    }

    if (evidenceMatch) {
      const id = evidenceMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID de misión inválido', 400)
        return true
      }
      const evidence = await getMissionEvidenceDto(id)
      if (!evidence) {
        jsonError(req, res, 'Misión no encontrada', 404)
        return true
      }
      jsonResponse(req, res, evidence)
      return true
    }

    if (detailMatch) {
      const id = detailMatch[1]
      if (!UUID_RE.test(id)) {
        jsonError(req, res, 'ID de misión inválido', 400)
        return true
      }
      const detail = await getMissionDetail(id)
      if (!detail) {
        jsonError(req, res, 'Misión no encontrada', 404)
        return true
      }
      jsonResponse(req, res, detail)
      return true
    }

    if (pathname === '/api/operations/missions') {
      const result = await listMissionsDto({
        status: searchParams.get('status') ?? undefined,
        incident_id: searchParams.get('incident_id') ?? undefined,
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
