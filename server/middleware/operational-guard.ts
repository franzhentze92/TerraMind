import type { IncomingMessage, ServerResponse } from 'node:http'

import type { AuthorizedResourceContext, RequestAuthContext, TerramindPermission } from '@/core/auth/permissions'
import { AuthorizationError, AuthenticationError, assertPermission } from '@/core/auth/permissions'
import { rejectIfUnauthenticated, requireRequestAuth } from './auth.js'
import { jsonError } from '../http/json.js'
import { recordAuthAuditEvent } from '../services/auth-audit.service.js'
import { rejectIfRateLimited, type RateLimitProfile } from './rate-limit.js'

export type OperationalHandler<T> = (
  auth: RequestAuthContext,
  ctx?: AuthorizedResourceContext,
) => Promise<T>

export interface OperationalGuardOptions {
  permission: TerramindPermission
  rateLimit?: RateLimitProfile
  authorize?: (auth: RequestAuthContext) => Promise<AuthorizedResourceContext>
  auditType?: string
  resourceType?: string
  resourceId?: string
}

function handleGuardError(req: IncomingMessage, res: ServerResponse, err: unknown): void {
  if (err instanceof AuthorizationError) {
    void recordAuthAuditEvent({
      event_type: 'permission_denied',
      outcome: 'denied',
      req,
      metadata: { reason: err.message },
    })
    jsonError(req, res, err.message, err.status)
    return
  }
  if (err instanceof AuthenticationError) {
    jsonError(req, res, err.message, 401)
    return
  }
  if (err instanceof Error && err.message.includes('no encontrad')) {
    jsonError(req, res, err.message, 404)
    return
  }
  jsonError(req, res, err instanceof Error ? err.message : 'Forbidden', 403)
}

export async function runOperationalGuard<T>(
  req: IncomingMessage,
  res: ServerResponse,
  options: OperationalGuardOptions,
  handler: OperationalHandler<T>,
): Promise<T | null> {
  if (await rejectIfUnauthenticated(req, res)) return null
  if (options.rateLimit && rejectIfRateLimited(req, res, options.rateLimit)) return null

  try {
    const auth = requireRequestAuth(req)
    assertPermission(auth, options.permission)
    const ctx = options.authorize ? await options.authorize(auth) : undefined
    const result = await handler(auth, ctx)
    if (options.auditType) {
      await recordAuthAuditEvent({
        event_type: options.auditType,
        outcome: 'allowed',
        req,
        auth,
        resource_type: options.resourceType,
        resource_id: options.resourceId ?? ctx?.resourceId,
      })
    }
    return result
  } catch (err) {
    handleGuardError(req, res, err)
    return null
  }
}

export function orgListScope(auth: RequestAuthContext): { organization_id: string } {
  return { organization_id: auth.activeOrganizationId }
}
