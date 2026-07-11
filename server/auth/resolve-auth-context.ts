import type { IncomingMessage } from 'node:http'
import { createClient } from '@supabase/supabase-js'

import type { RequestAuthContext, TerramindRole } from '@/core/auth/permissions'
import { AuthenticationError } from '@/core/auth/permissions'
import { permissionsForRoles } from '../auth/role-permissions.js'
import { resolveTestAuthToken } from '../auth/test-fixtures.js'

const authContextByRequest = new WeakMap<IncomingMessage, RequestAuthContext>()

export function getStoredAuthContext(req: IncomingMessage): RequestAuthContext | undefined {
  return authContextByRequest.get(req)
}

export function storeAuthContext(req: IncomingMessage, ctx: RequestAuthContext): void {
  authContextByRequest.set(req, ctx)
}

export function extractBearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length).trim()
}

function isAuthTestMode(): boolean {
  return process.env.AUTH_TEST_MODE === '1' || process.env.NODE_ENV === 'test'
}

function isAuthEnforced(): boolean {
  if (process.env.AUTH_ENFORCE === 'false') return false
  if (process.env.AUTH_ENFORCE === 'true') return true
  return process.env.NODE_ENV === 'production'
}

export async function resolveRequestAuth(req: IncomingMessage): Promise<RequestAuthContext | null> {
  const cached = getStoredAuthContext(req)
  if (cached) return cached

  if (!isAuthEnforced()) {
    const devCtx: RequestAuthContext = {
      authUserId: 'dev-auth-user',
      userId: 'dev-user-profile',
      activeOrganizationId: process.env.AUTH_DEV_ORG_ID ?? '00000000-0000-4000-a07f-000000000001',
      membershipId: 'dev-membership',
      roles: ['operations_coordinator'],
      permissions: permissionsForRoles(['operations_coordinator']),
      isPlatformAdmin: false,
    }
    storeAuthContext(req, devCtx)
    return devCtx
  }

  const token = extractBearerToken(req)
  if (!token) return null

  if (isAuthTestMode() && token.startsWith('test-')) {
    try {
      const ctx = resolveTestAuthToken(token)
      if (!ctx) return null
      storeAuthContext(req, ctx)
      return ctx
    } catch (err) {
      if (err instanceof AuthenticationError) throw err
      return null
    }
  }

  const url = process.env.SUPABASE_URL?.trim()
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) {
    if (process.env.NODE_ENV === 'test') return null
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY required for auth enforcement')
  }

  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data.user) return null

  const ctx = await loadAuthContextFromDatabase(data.user.id, req)
  if (!ctx) return null
  storeAuthContext(req, ctx)
  return ctx
}

async function loadAuthContextFromDatabase(
  authUserId: string,
  req: IncomingMessage,
): Promise<RequestAuthContext | null> {
  const orgHeader = req.headers['x-terramind-organization-id']
  const requestedOrg =
    typeof orgHeader === 'string' && orgHeader.trim() ? orgHeader.trim() : undefined
  const { buildAuthSessionPayload } = await import('../services/provisioning/session.service.js')
  const session = await buildAuthSessionPayload(authUserId, requestedOrg)
  return session.context
}

export function requireRequestAuth(req: IncomingMessage): RequestAuthContext {
  const ctx = getStoredAuthContext(req)
  if (!ctx) throw new AuthenticationError()
  return ctx
}
