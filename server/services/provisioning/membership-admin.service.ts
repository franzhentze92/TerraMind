import type { RequestAuthContext, TerramindRole } from '@/core/auth/permissions'
import { AuthorizationError } from '@/core/auth/permissions'
import {
  addTestMembershipRole,
  countOrgAdmins,
  getTestMembership,
  getTestMembershipRoles,
  listTestMembers,
  removeTestMembershipRole,
  setTestMembershipRoles,
  updateTestMembership,
} from '../../auth/provisioning-test-store.js'
import { assertCanManageMembership } from './invitation.service.js'

const ASSIGNABLE_ROLES: TerramindRole[] = [
  'organization_admin',
  'operations_coordinator',
  'field_supervisor',
  'field_technician',
  'analyst',
  'viewer',
]

function assertRoleAssignable(role: TerramindRole): void {
  if (role === 'platform_admin') {
    throw new AuthorizationError('No se puede asignar platform_admin', 403)
  }
  if (!ASSIGNABLE_ROLES.includes(role)) {
    throw new AuthorizationError(`Rol no asignable: ${role}`, 400)
  }
}

export async function listOrganizationMembers(auth: RequestAuthContext) {
  assertCanManageMembership(auth, auth.activeOrganizationId)
  if (process.env.AUTH_TEST_MODE === '1' || process.env.NODE_ENV === 'test') {
    return listTestMembers(auth.activeOrganizationId).map((m) => ({
      membership_id: m.id,
      user_id: m.profile.id,
      email: m.profile.email,
      display_name: m.profile.display_name,
      status: m.status,
      roles: m.roles,
      joined_at: m.joined_at,
      invited_at: m.invited_at,
    }))
  }

  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('organization_memberships')
    .select('id, user_id, status, joined_at, invited_at, user_profiles(id, email, display_name), membership_roles(role_id)')
    .eq('organization_id', auth.activeOrganizationId)
    .neq('status', 'revoked')
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    membership_id: String(row.id),
    user_id: String((row.user_profiles as { id: string }).id),
    email: String((row.user_profiles as { email: string }).email),
    display_name: String((row.user_profiles as { display_name: string }).display_name),
    status: String(row.status),
    roles: ((row.membership_roles as Array<{ role_id: string }>) ?? []).map((r) => r.role_id as TerramindRole),
    joined_at: row.joined_at,
    invited_at: row.invited_at,
  }))
}

async function getMembershipInOrg(auth: RequestAuthContext, membershipId: string) {
  if (process.env.AUTH_TEST_MODE === '1' || process.env.NODE_ENV === 'test') {
    const member = listTestMembers(auth.activeOrganizationId).find((m) => m.id === membershipId)
    if (!member) throw new AuthorizationError('Membership no encontrada', 404)
    return member
  }

  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const { data, error } = await getSupabaseAdmin()
    .from('organization_memberships')
    .select('id, user_id, status, organization_id, membership_roles(role_id)')
    .eq('id', membershipId)
    .eq('organization_id', auth.activeOrganizationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new AuthorizationError('Membership no encontrada', 404)
  return data
}

export async function suspendOrganizationMembership(auth: RequestAuthContext, membershipId: string) {
  assertCanManageMembership(auth, auth.activeOrganizationId)
  if (process.env.AUTH_TEST_MODE === '1' || process.env.NODE_ENV === 'test') {
    const member = await getMembershipInOrg(auth, membershipId)
    updateTestMembership(membershipId, { status: 'suspended' })
    return { membership_id: membershipId, status: 'suspended', user_id: member.user_id }
  }

  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const { data, error } = await getSupabaseAdmin()
    .from('organization_memberships')
    .update({ status: 'suspended', updated_at: new Date().toISOString() })
    .eq('id', membershipId)
    .eq('organization_id', auth.activeOrganizationId)
    .select('id, user_id, status')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new AuthorizationError('Membership no encontrada', 404)
  return { membership_id: String(data.id), status: String(data.status), user_id: String(data.user_id) }
}

export async function reactivateOrganizationMembership(auth: RequestAuthContext, membershipId: string) {
  assertCanManageMembership(auth, auth.activeOrganizationId)
  if (process.env.AUTH_TEST_MODE === '1' || process.env.NODE_ENV === 'test') {
    const member = await getMembershipInOrg(auth, membershipId)
    updateTestMembership(membershipId, { status: 'active' })
    return { membership_id: membershipId, status: 'active', user_id: member.user_id }
  }

  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const { data, error } = await getSupabaseAdmin()
    .from('organization_memberships')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', membershipId)
    .eq('organization_id', auth.activeOrganizationId)
    .select('id, user_id, status')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new AuthorizationError('Membership no encontrada', 404)
  return { membership_id: String(data.id), status: String(data.status), user_id: String(data.user_id) }
}

export async function revokeOrganizationMembership(auth: RequestAuthContext, membershipId: string) {
  assertCanManageMembership(auth, auth.activeOrganizationId)
  if (process.env.AUTH_TEST_MODE === '1' || process.env.NODE_ENV === 'test') {
    const member = await getMembershipInOrg(auth, membershipId)
    if (member.roles.includes('organization_admin') && countOrgAdmins(auth.activeOrganizationId) <= 1) {
      throw new AuthorizationError('No se puede revocar al último administrador', 409)
    }
    updateTestMembership(membershipId, { status: 'revoked', revoked_at: new Date().toISOString() })
    return { membership_id: membershipId, status: 'revoked', user_id: member.user_id }
  }

  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const { data, error } = await getSupabaseAdmin()
    .from('organization_memberships')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', membershipId)
    .eq('organization_id', auth.activeOrganizationId)
    .select('id, user_id, status')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new AuthorizationError('Membership no encontrada', 404)
  return { membership_id: String(data.id), status: String(data.status), user_id: String(data.user_id) }
}

export async function assignOrganizationRole(
  auth: RequestAuthContext,
  membershipId: string,
  role: TerramindRole,
) {
  assertCanManageMembership(auth, auth.activeOrganizationId)
  assertRoleAssignable(role)

  if (process.env.AUTH_TEST_MODE === '1' || process.env.NODE_ENV === 'test') {
    await getMembershipInOrg(auth, membershipId)
    addTestMembershipRole(membershipId, role)
    return { membership_id: membershipId, roles: getTestMembershipRoles(membershipId) }
  }

  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const admin = getSupabaseAdmin()
  await getMembershipInOrg(auth, membershipId)
  await admin.from('membership_roles').upsert({ membership_id: membershipId, role_id: role })
  const { data } = await admin.from('membership_roles').select('role_id').eq('membership_id', membershipId)
  return {
    membership_id: membershipId,
    roles: (data ?? []).map((r) => String(r.role_id) as TerramindRole),
  }
}

export async function removeOrganizationRole(
  auth: RequestAuthContext,
  membershipId: string,
  role: TerramindRole,
) {
  assertCanManageMembership(auth, auth.activeOrganizationId)
  assertRoleAssignable(role)

  if (process.env.AUTH_TEST_MODE === '1' || process.env.NODE_ENV === 'test') {
    const member = await getMembershipInOrg(auth, membershipId)
    if (role === 'organization_admin' && member.roles.includes('organization_admin') && countOrgAdmins(auth.activeOrganizationId) <= 1) {
      throw new AuthorizationError('No se puede retirar al último administrador', 409)
    }
    removeTestMembershipRole(membershipId, role)
    return { membership_id: membershipId, roles: getTestMembershipRoles(membershipId) }
  }

  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const admin = getSupabaseAdmin()
  await getMembershipInOrg(auth, membershipId)
  await admin.from('membership_roles').delete().eq('membership_id', membershipId).eq('role_id', role)
  const { data } = await admin.from('membership_roles').select('role_id').eq('membership_id', membershipId)
  return {
    membership_id: membershipId,
    roles: (data ?? []).map((r) => String(r.role_id) as TerramindRole),
  }
}

export async function replaceOrganizationRoles(
  auth: RequestAuthContext,
  membershipId: string,
  roles: TerramindRole[],
) {
  for (const role of roles) assertRoleAssignable(role)
  if (process.env.AUTH_TEST_MODE === '1' || process.env.NODE_ENV === 'test') {
    const member = await getMembershipInOrg(auth, membershipId)
    const nextHasAdmin = roles.includes('organization_admin')
    if (member.roles.includes('organization_admin') && !nextHasAdmin && countOrgAdmins(auth.activeOrganizationId) <= 1) {
      throw new AuthorizationError('No se puede retirar al último administrador', 409)
    }
    setTestMembershipRoles(membershipId, roles)
    return { membership_id: membershipId, roles }
  }

  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const admin = getSupabaseAdmin()
  await getMembershipInOrg(auth, membershipId)
  await admin.from('membership_roles').delete().eq('membership_id', membershipId)
  if (roles.length) {
    await admin.from('membership_roles').insert(roles.map((role_id) => ({ membership_id: membershipId, role_id })))
  }
  return { membership_id: membershipId, roles }
}

import { permissionsForRoles } from '../../auth/role-permissions.js'

export function listSystemRoles() {
  return ASSIGNABLE_ROLES.map((id) => ({
    id,
    scope: 'organization' as const,
    permissions: permissionsForRoles([id]),
  }))
}
