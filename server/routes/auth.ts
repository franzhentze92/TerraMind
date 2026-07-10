import type { IncomingMessage, ServerResponse } from 'node:http'

import { rejectIfUnauthenticated, requireRequestAuth } from '../middleware/auth.js'
import { readJsonBody } from '../http/body.js'
import { jsonError, jsonResponse } from '../http/json.js'
import { recordAuthAuditEvent } from '../services/auth-audit.service.js'
import { resolveRequestAuth } from '../auth/resolve-auth-context.js'

export async function handleAuthRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (pathname === '/api/auth/me' && req.method === 'GET') {
    if (await rejectIfUnauthenticated(req, res)) return true
    const ctx = requireRequestAuth(req)
    jsonResponse(req, res, {
      context: ctx,
    })
    return true
  }

  if (pathname === '/api/auth/active-organization' && req.method === 'POST') {
    if (await rejectIfUnauthenticated(req, res)) return true
    const current = requireRequestAuth(req)
    const body = await readJsonBody<{ organization_id?: string }>(req)
    const organizationId = body.organization_id?.trim()
    if (!organizationId) {
      jsonError(req, res, 'organization_id requerido', 400)
      return true
    }
    if (organizationId === current.activeOrganizationId) {
      jsonResponse(req, res, { context: current })
      return true
    }

    const refreshed = await resolveRequestAuth(req)
    if (!refreshed || refreshed.activeOrganizationId !== organizationId) {
      await recordAuthAuditEvent({
        event_type: 'organization_switch_denied',
        outcome: 'denied',
        req,
        auth: current,
        metadata: { requested_organization_id: organizationId },
      })
      jsonError(req, res, 'Membership no activa para la organización solicitada', 403)
      return true
    }

    await recordAuthAuditEvent({
      event_type: 'organization_switch',
      outcome: 'allowed',
      req,
      auth: refreshed,
      organization_id: organizationId,
    })
    jsonResponse(req, res, { context: refreshed })
    return true
  }

  return false
}
