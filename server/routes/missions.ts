import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  getIncidentMissions,
  getMissionDetail,
  getMissionEvidenceDto,
  getMissionTasksDto,
  getVerificationPlanMissions,
  listMissionsDto,
} from '../services/missions.service.js'
import { rejectIfUnauthenticated } from '../middleware/auth.js'
import { jsonError, jsonResponse } from '../http/json.js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
  const isOperationsMissions = pathname.startsWith('/api/operations/missions')

  if (!isOperationsMissions && !incidentMissionsMatch && !planMissionsMatch) return false
  if (req.method !== 'GET') {
    jsonError(req, res, 'Method not allowed', 405)
    return true
  }
  if (rejectIfUnauthenticated(req, res)) return true

  try {
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
