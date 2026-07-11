import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'

import type { RequestAuthContext, TerramindRole } from '@/core/auth/permissions'
import { AuthenticationError, AuthorizationError } from '@/core/auth/permissions'
import { permissionsForRoles } from '../../auth/role-permissions.js'
import {
  getTestMembership,
  getTestMembershipRoles,
  getTestOrganizations,
  getTestProfileByAuthUserId,
  getTestProfileById,
  isProvisioningTestMode,
  listTestMembershipsForUser,
  updateTestProfile,
} from '../../auth/provisioning-test-store.js'

export type SessionState =
  | 'active'
  | 'invited'
  | 'awaiting_access'
  | 'suspended'
  | 'revoked'

export interface AuthSessionPayload {
  state: SessionState
  context: RequestAuthContext | null
  profile: {
    id: string
    email: string
    display_name: string
    provisioning_status: string
    is_platform_admin: boolean
  } | null
  organizations: Array<{ id: string; name: string; slug: string; membership_status: string }>
}

export async function buildAuthSessionPayload(
  authUserId: string,
  requestedOrgId?: string | null,
): Promise<AuthSessionPayload> {
  if (isProvisioningTestMode()) {
    const testProfile = getTestProfileByAuthUserId(authUserId)
    if (testProfile || process.env.NODE_ENV === 'test') {
      return buildTestAuthSessionPayload(authUserId, requestedOrgId)
    }
  }

  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const admin = getSupabaseAdmin()

  const { data: profile } = await admin
    .from('user_profiles')
    .select('id, email, display_name, active_organization_id, is_platform_admin, provisioning_status')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (!profile) {
    return { state: 'awaiting_access', context: null, profile: null, organizations: [] }
  }

  const { data: membershipRows } = await admin
    .from('organization_memberships')
    .select('id, organization_id, status, organizations(id, name, slug)')
    .eq('user_id', profile.id)
    .neq('status', 'revoked')

  const organizations =
    membershipRows?.map((row) => {
      const org = row.organizations as { id: string; name: string; slug: string } | null
      return {
        id: String(org?.id ?? row.organization_id),
        name: String(org?.name ?? 'Organización'),
        slug: String(org?.slug ?? ''),
        membership_status: String(row.status),
      }
    }) ?? []

  const requested = requestedOrgId?.trim()
  const profileOrg = profile.active_organization_id ? String(profile.active_organization_id) : undefined
  const fallbackOrg =
    profileOrg || organizations.find((o) => o.membership_status === 'active')?.id

  let activeOrgId = requested || fallbackOrg
  if (requested) {
    const hasRequestedMembership = membershipRows?.some(
      (m) => String(m.organization_id) === requested && m.status !== 'revoked',
    )
    if (!hasRequestedMembership) {
      activeOrgId = fallbackOrg
    }
  }

  const profileDto = {
    id: String(profile.id),
    email: String(profile.email),
    display_name: String(profile.display_name),
    provisioning_status: String(profile.provisioning_status ?? 'active'),
    is_platform_admin: Boolean(profile.is_platform_admin),
  }

  if (!activeOrgId) {
    return {
      state: profile.provisioning_status === 'awaiting_access' ? 'awaiting_access' : 'invited',
      context: null,
      profile: profileDto,
      organizations,
    }
  }

  const membership = membershipRows?.find((m) => String(m.organization_id) === activeOrgId)
  if (!membership) {
    return { state: 'awaiting_access', context: null, profile: profileDto, organizations }
  }

  if (membership.status === 'suspended') {
    return { state: 'suspended', context: null, profile: profileDto, organizations }
  }
  if (membership.status === 'revoked') {
    return { state: 'revoked', context: null, profile: profileDto, organizations }
  }

  const { data: roleRows } = await admin
    .from('membership_roles')
    .select('role_id')
    .eq('membership_id', membership.id)

  const roles = (roleRows ?? []).map((r) => String(r.role_id) as TerramindRole)
  const context: RequestAuthContext = {
    authUserId,
    userId: String(profile.id),
    activeOrganizationId: activeOrgId,
    membershipId: String(membership.id),
    roles,
    permissions: permissionsForRoles(roles),
    isPlatformAdmin: Boolean(profile.is_platform_admin),
  }

  return {
    state: membership.status === 'invited' ? 'invited' : 'active',
    context,
    profile: profileDto,
    organizations,
  }
}

function buildTestAuthSessionPayload(authUserId: string, requestedOrgId?: string | null): AuthSessionPayload {
  const profile = getTestProfileByAuthUserId(authUserId)
  if (!profile) {
    return { state: 'awaiting_access', context: null, profile: null, organizations: [] }
  }

  const memberships = listTestMembershipsForUser(profile.id)
  const orgCatalog = getTestOrganizations()
  const organizations = memberships.map((m) => {
    const org = orgCatalog.find((o) => o.id === m.organization_id)
    return {
      id: m.organization_id,
      name: org?.name ?? 'Organización',
      slug: org?.slug ?? '',
      membership_status: m.status,
    }
  })

  const profileDto = {
    id: profile.id,
    email: profile.email,
    display_name: profile.display_name,
    provisioning_status: profile.provisioning_status,
    is_platform_admin: profile.is_platform_admin,
  }

  const activeOrgId =
    requestedOrgId?.trim() ||
    profile.active_organization_id ||
    organizations.find((o) => o.membership_status === 'active')?.id

  if (!activeOrgId) {
    return { state: 'awaiting_access', context: null, profile: profileDto, organizations }
  }

  const membership = getTestMembership(profile.id, activeOrgId)
  if (!membership) {
    return { state: 'awaiting_access', context: null, profile: profileDto, organizations }
  }

  if (membership.status === 'suspended') {
    return { state: 'suspended', context: null, profile: profileDto, organizations }
  }
  if (membership.status === 'revoked') {
    return { state: 'revoked', context: null, profile: profileDto, organizations }
  }

  const roles = getTestMembershipRoles(membership.id)
  const context: RequestAuthContext = {
    authUserId,
    userId: profile.id,
    activeOrganizationId: activeOrgId,
    membershipId: membership.id,
    roles,
    permissions: permissionsForRoles(roles),
    isPlatformAdmin: profile.is_platform_admin,
  }

  return {
    state: membership.status === 'invited' ? 'invited' : 'active',
    context,
    profile: profileDto,
    organizations,
  }
}

export async function switchActiveOrganization(
  auth: RequestAuthContext,
  organizationId: string,
): Promise<RequestAuthContext> {
  if (isProvisioningTestMode()) {
    const membership = getTestMembership(auth.userId, organizationId)
    if (!membership || membership.status !== 'active') {
      throw new AuthorizationError('Membership no activa para la organización solicitada', 403)
    }
    updateTestProfile(auth.userId, { active_organization_id: organizationId })
    const roles = getTestMembershipRoles(membership.id)
    return {
      ...auth,
      activeOrganizationId: organizationId,
      membershipId: membership.id,
      roles,
      permissions: permissionsForRoles(roles),
    }
  }

  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const admin = getSupabaseAdmin()
  const { data: membershipRow } = await admin
    .from('organization_memberships')
    .select('id, status')
    .eq('user_id', auth.userId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!membershipRow || membershipRow.status !== 'active') {
    throw new AuthorizationError('Membership no activa para la organización solicitada', 403)
  }

  await admin
    .from('user_profiles')
    .update({ active_organization_id: organizationId, updated_at: new Date().toISOString() })
    .eq('id', auth.userId)

  const { data: roleRows } = await admin
    .from('membership_roles')
    .select('role_id')
    .eq('membership_id', membershipRow.id)

  const roles = (roleRows ?? []).map((r) => String(r.role_id) as TerramindRole)
  return {
    ...auth,
    activeOrganizationId: organizationId,
    membershipId: String(membershipRow.id),
    roles,
    permissions: permissionsForRoles(roles),
  }
}

export function newProvisioningId(): string {
  return randomUUID()
}
