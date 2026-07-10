import type { IncomingMessage, ServerResponse } from 'node:http'

import { AuthenticationError, AuthorizationError } from '@/core/auth/permissions'
import type { TerramindPermission } from '@/core/auth/permissions'
import { resolveRequestAuth, requireRequestAuth } from '../auth/resolve-auth-context.js'
import { recordAuthAuditEvent } from '../services/auth-audit.service.js'
import { jsonError } from '../http/json.js'

export { requireRequestAuth, getStoredAuthContext } from '../auth/resolve-auth-context.js'

/**
 * Validates bearer token / session and attaches RequestAuthContext to the request.
 * Returns true when the response was already sent (401/403).
 */
export async function rejectIfUnauthenticated(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  try {
    const ctx = await resolveRequestAuth(req)
    if (!ctx) {
      await recordAuthAuditEvent({
        event_type: 'auth_missing',
        outcome: 'denied',
        req,
      })
      jsonError(req, res, 'Unauthorized', 401)
      return true
    }
    return false
  } catch (err) {
    const message =
      err instanceof AuthenticationError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Unauthorized'
    await recordAuthAuditEvent({
      event_type: 'auth_invalid',
      outcome: 'denied',
      req,
      metadata: { reason: message },
    })
    jsonError(req, res, message, err instanceof AuthenticationError ? 401 : 401)
    return true
  }
}

export async function rejectUnlessPermission(
  req: IncomingMessage,
  res: ServerResponse,
  permission: TerramindPermission,
): Promise<boolean> {
  if (await rejectIfUnauthenticated(req, res)) return true
  try {
    const ctx = requireRequestAuth(req)
    if (!ctx.isPlatformAdmin && !ctx.permissions.includes(permission)) {
      await recordAuthAuditEvent({
        event_type: 'permission_denied',
        outcome: 'denied',
        req,
        auth: ctx,
        metadata: { permission },
      })
      jsonError(req, res, 'Forbidden', 403)
      return true
    }
    return false
  } catch (err) {
    if (err instanceof AuthorizationError) {
      jsonError(req, res, err.message, err.status)
      return true
    }
    jsonError(req, res, 'Forbidden', 403)
    return true
  }
}

/** @deprecated Stub removed — use rejectIfUnauthenticated. Kept for audit script detection. */
export function requireAuth(): boolean {
  throw new Error('requireAuth stub removed in 8B.7F — use rejectIfUnauthenticated')
}
