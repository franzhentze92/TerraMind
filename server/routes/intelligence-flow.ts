import type { IncomingMessage, ServerResponse } from 'node:http'
import { jsonError, jsonResponse } from '../http/json.js'
import { rejectInvalidUuid } from '../http/route-utils.js'
import { runOperationalGuard } from '../middleware/operational-guard.js'
import {
  authorizeFindingAccess,
  authorizeIncidentAccess,
  authorizeMissionAccess,
  authorizePriorityAccess,
} from '../services/authorization/index.js'
import { getIntelligenceFlow } from '../services/intelligence-flow.service.js'
import type { IntelligenceFlowResourceType } from '@/modules/intelligence-flow/intelligence-flow.types'
import type { RequestAuthContext, TerramindPermission } from '@/core/auth/permissions'

const VALID_TYPES = new Set<IntelligenceFlowResourceType>([
  'finding',
  'priority',
  'incident',
  'mission',
  'evidence',
  'response',
])

function permissionForType(type: IntelligenceFlowResourceType): TerramindPermission {
  switch (type) {
    case 'finding':
      return 'findings.view'
    case 'priority':
      return 'priorities.view'
    case 'incident':
      return 'incidents.view'
    case 'response':
      return 'responses.view'
    case 'mission':
      return 'missions.view'
    case 'evidence':
      return 'evidence.view'
    default:
      return 'findings.view'
  }
}

function authorizeForType(type: IntelligenceFlowResourceType, id: string) {
  switch (type) {
    case 'finding':
      return (auth: RequestAuthContext) => authorizeFindingAccess(auth, id)
    case 'priority':
      return (auth: RequestAuthContext) => authorizePriorityAccess(auth, id)
    case 'incident':
    case 'response':
      return (auth: RequestAuthContext) => authorizeIncidentAccess(auth, id)
    case 'mission':
      return (auth: RequestAuthContext) => authorizeMissionAccess(auth, id)
    case 'evidence':
      return async (auth: RequestAuthContext) => {
        const { loadEvidenceSubmissionSnapshot } = await import(
          '../services/authorization/resource-resolver.js'
        )
        const snap = await loadEvidenceSubmissionSnapshot(id)
        if (!snap) throw new Error('Evidencia no encontrada')
        return authorizeMissionAccess(auth, String(snap.mission_id))
      }
    default:
      return undefined
  }
}

export async function handleIntelligenceFlowRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  const match = pathname.match(/^\/api\/intelligence-flow\/([^/]+)\/([^/]+)$/)
  if (!match) return false
  if (req.method !== 'GET') {
    jsonError(req, res, 'Method not allowed', 405)
    return true
  }

  const resourceType = match[1] as IntelligenceFlowResourceType
  const resourceId = match[2]

  if (!VALID_TYPES.has(resourceType)) {
    jsonError(req, res, 'Tipo de recurso no válido', 400)
    return true
  }
  if (rejectInvalidUuid(req, res, resourceId, 'ID de recurso')) return true

  try {
    const result = await runOperationalGuard(
      req,
      res,
      {
        permission: permissionForType(resourceType),
        rateLimit: 'default_read',
        authorize: authorizeForType(resourceType, resourceId),
      },
      async (auth) => getIntelligenceFlow(resourceType, resourceId, auth),
    )
    if (result === null) return true
    if (!result) {
      jsonError(req, res, 'Recurso no encontrado', 404)
      return true
    }
    jsonResponse(req, res, result)
    return true
  } catch (err) {
    jsonError(req, res, err instanceof Error ? err.message : 'Error interno', 500)
    return true
  }
}
