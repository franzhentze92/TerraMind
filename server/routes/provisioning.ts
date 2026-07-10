import type { IncomingMessage, ServerResponse } from 'node:http'

import type { TerramindRole } from '@/core/auth/permissions'
import { extractBearerToken, storeAuthContext } from '../auth/resolve-auth-context.js'
import { rejectIfUnauthenticated, requireRequestAuth } from '../middleware/auth.js'
import { rejectIfRateLimited } from '../middleware/rate-limit.js'
import { runOperationalGuard } from '../middleware/operational-guard.js'
import { readJsonBody } from '../http/body.js'
import { rejectInvalidUuid } from '../http/route-utils.js'
import { jsonError, jsonResponse } from '../http/json.js'
import { recordAuthAuditEvent } from '../services/auth-audit.service.js'
import { createClient } from '@supabase/supabase-js'
import {
  acceptOrganizationInvitation,
  createOrganizationInvitation,
  listOrganizationInvitations,
  revokeOrganizationInvitation,
} from '../services/provisioning/invitation.service.js'
import {
  assignOrganizationRole,
  listOrganizationMembers,
  listSystemRoles,
  reactivateOrganizationMembership,
  removeOrganizationRole,
  revokeOrganizationMembership,
  suspendOrganizationMembership,
} from '../services/provisioning/membership-admin.service.js'
import { buildAuthSessionPayload, switchActiveOrganization } from '../services/provisioning/session.service.js'

async function resolveAuthUserId(req: IncomingMessage): Promise<string | null> {
  const token = extractBearerToken(req)
  if (!token) return null
  if (process.env.AUTH_TEST_MODE === '1' && token.startsWith('test-')) {
    const { resolveTestAuthToken } = await import('../auth/test-fixtures.js')
    return resolveTestAuthToken(token)?.authUserId ?? null
  }
  const url = process.env.SUPABASE_URL?.trim()
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) return null
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data } = await client.auth.getUser(token)
  return data.user?.id ?? null
}

export async function handleProvisioningRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  const acceptMatch = pathname === '/api/auth/invitations/accept'
  if (acceptMatch && req.method === 'POST') {
    const body = await readJsonBody<Record<string, unknown>>(req)
    const token = String(body.token ?? '')
    if (!token) {
      jsonError(req, res, 'token requerido', 400)
      return true
    }
    const authUserId = await resolveAuthUserId(req)
    if (!authUserId) {
      jsonError(req, res, 'Unauthorized', 401)
      return true
    }
    try {
      const result = await acceptOrganizationInvitation({
        token,
        auth_user_id: authUserId,
        email: String(body.email ?? ''),
        display_name: body.display_name ? String(body.display_name) : undefined,
      })
      await recordAuthAuditEvent({
        event_type: 'invitation_accepted',
        outcome: 'allowed',
        req,
        metadata: { organization_id: result.organization_id },
      })
      jsonResponse(req, res, result)
    } catch (err) {
      jsonError(req, res, err instanceof Error ? err.message : 'accept_failed', 403)
    }
    return true
  }

  if (pathname === '/api/auth/memberships' && req.method === 'GET') {
    if (await rejectIfUnauthenticated(req, res)) return true
    const authUserId = await resolveAuthUserId(req)
    if (!authUserId) {
      jsonError(req, res, 'Unauthorized', 401)
      return true
    }
    const session = await buildAuthSessionPayload(authUserId)
    jsonResponse(req, res, { organizations: session.organizations, state: session.state })
    return true
  }

  if (pathname.startsWith('/api/admin/organization')) {
    const membersMatch = pathname === '/api/admin/organization/members'
    const invitationsMatch = pathname === '/api/admin/organization/invitations'
    const invitationRevokeMatch = pathname.match(/^\/api\/admin\/organization\/invitations\/([^/]+)\/revoke$/)
    const membershipSuspendMatch = pathname.match(/^\/api\/admin\/organization\/memberships\/([^/]+)\/suspend$/)
    const membershipReactivateMatch = pathname.match(/^\/api\/admin\/organization\/memberships\/([^/]+)\/reactivate$/)
    const membershipRevokeMatch = pathname.match(/^\/api\/admin\/organization\/memberships\/([^/]+)\/revoke$/)
    const membershipRolesMatch = pathname.match(/^\/api\/admin\/organization\/memberships\/([^/]+)\/roles(?:\/([^/]+))?$/)
    const rolesMatch = pathname === '/api/admin/organization/roles'
    const auditMatch = pathname === '/api/admin/organization/audit'

    if (membersMatch && req.method === 'GET') {
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'memberships.manage', rateLimit: 'default_read' },
        async (auth) => listOrganizationMembers(auth),
      )
      if (result === null) return true
      jsonResponse(req, res, { items: result })
      return true
    }

    if (invitationsMatch && req.method === 'GET') {
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'users.invite', rateLimit: 'default_read' },
        async (auth) => listOrganizationInvitations(auth),
      )
      if (result === null) return true
      jsonResponse(req, res, { items: result })
      return true
    }

    if (invitationsMatch && req.method === 'POST') {
      const body = await readJsonBody<Record<string, unknown>>(req)
      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'users.invite',
          rateLimit: 'invitation',
          auditType: 'invitation_created',
        },
        async (auth) =>
          createOrganizationInvitation(auth, {
            email: String(body.email ?? ''),
            display_name: body.display_name ? String(body.display_name) : undefined,
            roles: (body.roles as TerramindRole[]) ?? ['viewer'],
            expires_in_hours: body.expires_in_hours != null ? Number(body.expires_in_hours) : undefined,
            idempotency_key: body.idempotency_key ? String(body.idempotency_key) : undefined,
          }),
      )
      if (result === null) return true
      jsonResponse(req, res, result, 201)
      return true
    }

    if (invitationRevokeMatch && req.method === 'POST') {
      const id = invitationRevokeMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de invitación')) return true
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'users.invite', auditType: 'invitation_revoked' },
        async (auth) => revokeOrganizationInvitation(auth, id),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (membershipSuspendMatch && req.method === 'POST') {
      const id = membershipSuspendMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de membership')) return true
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'memberships.manage', auditType: 'membership_suspended' },
        async (auth) => suspendOrganizationMembership(auth, id),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (membershipReactivateMatch && req.method === 'POST') {
      const id = membershipReactivateMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de membership')) return true
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'memberships.manage', auditType: 'membership_reactivated' },
        async (auth) => reactivateOrganizationMembership(auth, id),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (membershipRevokeMatch && req.method === 'POST') {
      const id = membershipRevokeMatch[1]
      if (rejectInvalidUuid(req, res, id, 'ID de membership')) return true
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'memberships.manage', auditType: 'membership_revoked' },
        async (auth) => revokeOrganizationMembership(auth, id),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (membershipRolesMatch) {
      const membershipId = membershipRolesMatch[1]
      const roleId = membershipRolesMatch[2]
      if (rejectInvalidUuid(req, res, membershipId, 'ID de membership')) return true

      if (req.method === 'POST') {
        const body = await readJsonBody<{ role?: TerramindRole }>(req)
        if (!body.role) {
          jsonError(req, res, 'role requerido', 400)
          return true
        }
        const result = await runOperationalGuard(
          req,
          res,
          { permission: 'roles.manage', auditType: 'role_assigned' },
          async (auth) => assignOrganizationRole(auth, membershipId, body.role!),
        )
        if (result === null) return true
        jsonResponse(req, res, result)
        return true
      }

      if (req.method === 'DELETE' && roleId) {
        const result = await runOperationalGuard(
          req,
          res,
          { permission: 'roles.manage', auditType: 'role_removed' },
          async (auth) => removeOrganizationRole(auth, membershipId, roleId as TerramindRole),
        )
        if (result === null) return true
        jsonResponse(req, res, result)
        return true
      }
    }

    if (rolesMatch && req.method === 'GET') {
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'roles.manage', rateLimit: 'default_read' },
        async () => listSystemRoles(),
      )
      if (result === null) return true
      jsonResponse(req, res, { items: result })
      return true
    }

    if (auditMatch && req.method === 'GET') {
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'organization.settings', rateLimit: 'default_read' },
        async (auth) => {
          const { listRecentAuthAuditEvents } = await import('../services/auth-audit.service.js')
          return listRecentAuthAuditEvents(auth.activeOrganizationId)
        },
      )
      if (result === null) return true
      jsonResponse(req, res, { items: result })
      return true
    }
  }

  return false
}

export async function handleAuthSessionRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const authUserId = await resolveAuthUserId(req)
    if (!authUserId) {
      jsonError(req, res, 'Unauthorized', 401)
      return true
    }
    const orgHeader = req.headers['x-terramind-organization-id']
    const requestedOrg =
      typeof orgHeader === 'string' && orgHeader.trim() ? orgHeader.trim() : undefined
    const session = await buildAuthSessionPayload(authUserId, requestedOrg)
    if (session.context) storeAuthContext(req, session.context)
    jsonResponse(req, res, session)
    return true
  }

  if (pathname === '/api/auth/active-organization' && req.method === 'POST') {
    if (await rejectIfUnauthenticated(req, res)) return true
    if (rejectIfRateLimited(req, res, 'org_switch')) return true
    const auth = requireRequestAuth(req)
    const body = await readJsonBody<{ organization_id?: string }>(req)
    const organizationId = body.organization_id?.trim()
    if (!organizationId) {
      jsonError(req, res, 'organization_id requerido', 400)
      return true
    }
    try {
      const refreshed = await switchActiveOrganization(auth, organizationId)
      storeAuthContext(req, refreshed)
      await recordAuthAuditEvent({
        event_type: 'organization_switch',
        outcome: 'allowed',
        req,
        auth: refreshed,
        organization_id: organizationId,
      })
      const session = await buildAuthSessionPayload(refreshed.authUserId, organizationId)
      jsonResponse(req, res, session)
    } catch (err) {
      await recordAuthAuditEvent({
        event_type: 'organization_switch_denied',
        outcome: 'denied',
        req,
        auth,
        metadata: { requested_organization_id: organizationId },
      })
      jsonError(req, res, err instanceof Error ? err.message : 'switch_denied', 403)
    }
    return true
  }

  return false
}
