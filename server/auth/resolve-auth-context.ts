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

  if (isAuthTestMode()) {
    return null
  }

  const url = process.env.SUPABASE_URL?.trim()
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) {
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
  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const admin = getSupabaseAdmin()

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('id, active_organization_id, is_platform_admin')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (profileError || !profile?.active_organization_id) return null

  const orgHeader = req.headers['x-terramind-organization-id']
  const activeOrgId =
    typeof orgHeader === 'string' && orgHeader.trim()
      ? orgHeader.trim()
      : String(profile.active_organization_id)

  const { data: membership, error: membershipError } = await admin
    .from('organization_memberships')
    .select('id, status')
    .eq('user_id', profile.id)
    .eq('organization_id', activeOrgId)
    .maybeSingle()

  if (membershipError || !membership || membership.status !== 'active') {
    if (membership?.status === 'suspended') throw new AuthenticationError('Membership suspended')
    if (membership?.status === 'revoked') return null
    return null
  }

  const { data: roleRows } = await admin
    .from('membership_roles')
    .select('role_id')
    .eq('membership_id', membership.id)

  const roles = (roleRows ?? []).map((r) => String(r.role_id) as TerramindRole)
  const permissions = permissionsForRoles(roles)

  return {
    authUserId,
    userId: String(profile.id),
    activeOrganizationId: activeOrgId,
    membershipId: String(membership.id),
    roles,
    permissions,
    isPlatformAdmin: Boolean(profile.is_platform_admin),
  }
}

export function requireRequestAuth(req: IncomingMessage): RequestAuthContext {
  const ctx = getStoredAuthContext(req)
  if (!ctx) throw new AuthenticationError()
  return ctx
}
