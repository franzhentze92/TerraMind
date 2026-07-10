import type { RequestAuthContext, TerramindRole } from '@/core/auth/permissions'
import { AuthorizationError } from '@/core/auth/permissions'
import {
  countOrgAdmins,
  findInvitationByTokenHash,
  findPendingInvitationByEmail,
  getTestInvitationById,
  insertTestInvitation,
  insertTestMembership,
  insertTestProfile,
  isProvisioningTestMode,
  listTestInvitations,
  updateTestInvitation,
  updateTestMembership,
} from '../../auth/provisioning-test-store.js'
import { newProvisioningId } from './session.service.js'
import {
  buildInvitationAcceptUrl,
  generateInviteToken,
  hashInviteToken,
  inviteTokensMatch,
  normalizeInviteEmail,
} from './invite-token.js'

const ASSIGNABLE_ROLES: TerramindRole[] = [
  'organization_admin',
  'operations_coordinator',
  'field_supervisor',
  'field_technician',
  'analyst',
  'viewer',
]

function assertAssignableRoles(roles: TerramindRole[]): void {
  for (const role of roles) {
    if (role === 'platform_admin') {
      throw new AuthorizationError('No se puede asignar platform_admin por invitación', 403)
    }
    if (!ASSIGNABLE_ROLES.includes(role)) {
      throw new AuthorizationError(`Rol no asignable: ${role}`, 400)
    }
  }
}

export async function createOrganizationInvitation(
  auth: RequestAuthContext,
  input: {
    email: string
    display_name?: string
    roles: TerramindRole[]
    expires_in_hours?: number
    idempotency_key?: string
  },
) {
  assertAssignableRoles(input.roles)
  const email = normalizeInviteEmail(input.email)
  if (!email) throw new AuthorizationError('Email requerido', 400)

  const expiresAt = new Date(Date.now() + (input.expires_in_hours ?? 72) * 3600_000).toISOString()
  const rawToken = generateInviteToken()
  const tokenHash = hashInviteToken(rawToken)

  if (isProvisioningTestMode()) {
    const existing = findPendingInvitationByEmail(auth.activeOrganizationId, email)
    if (existing) {
      return {
        invitation: sanitizeInvitation(existing),
        accept_url: buildInvitationAcceptUrl(rawToken),
        idempotent_replay: true,
      }
    }
    const invitation = {
      id: newProvisioningId(),
      organization_id: auth.activeOrganizationId,
      email_normalized: email,
      display_name: input.display_name ?? email.split('@')[0],
      proposed_roles: input.roles,
      token_hash: tokenHash,
      status: 'pending' as const,
      invited_by_user_id: auth.userId,
      expires_at: expiresAt,
      accepted_at: null,
      revoked_at: null,
      created_at: new Date().toISOString(),
    }
    insertTestInvitation(invitation)
    return {
      invitation: sanitizeInvitation(invitation),
      accept_url: buildInvitationAcceptUrl(rawToken),
      idempotent_replay: false,
    }
  }

  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const admin = getSupabaseAdmin()
  const { data: existing } = await admin
    .from('organization_invitations')
    .select('*')
    .eq('organization_id', auth.activeOrganizationId)
    .eq('email_normalized', email)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return {
      invitation: sanitizeInvitation(existing),
      accept_url: null,
      idempotent_replay: true,
    }
  }

  const { data, error } = await admin
    .from('organization_invitations')
    .insert({
      organization_id: auth.activeOrganizationId,
      email_normalized: email,
      display_name: input.display_name ?? email.split('@')[0],
      proposed_roles: input.roles,
      token_hash: tokenHash,
      invited_by_user_id: auth.userId,
      expires_at: expiresAt,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return {
    invitation: sanitizeInvitation(data),
    accept_url: buildInvitationAcceptUrl(rawToken),
    idempotent_replay: false,
  }
}

export async function listOrganizationInvitations(auth: RequestAuthContext) {
  if (isProvisioningTestMode()) {
    return listTestInvitations(auth.activeOrganizationId).map(sanitizeInvitation)
  }
  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const { data, error } = await getSupabaseAdmin()
    .from('organization_invitations')
    .select('id, organization_id, email_normalized, display_name, proposed_roles, status, invited_by_user_id, expires_at, accepted_at, revoked_at, created_at')
    .eq('organization_id', auth.activeOrganizationId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(sanitizeInvitation)
}

export async function revokeOrganizationInvitation(auth: RequestAuthContext, invitationId: string) {
  if (isProvisioningTestMode()) {
    const row = getTestInvitationById(invitationId)
    if (!row || row.organization_id !== auth.activeOrganizationId) {
      throw new AuthorizationError('Invitación no encontrada', 404)
    }
    updateTestInvitation(invitationId, { status: 'revoked', revoked_at: new Date().toISOString() })
    return sanitizeInvitation(getTestInvitationById(invitationId)!)
  }

  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const { data, error } = await getSupabaseAdmin()
    .from('organization_invitations')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', invitationId)
    .eq('organization_id', auth.activeOrganizationId)
    .select('*')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new AuthorizationError('Invitación no encontrada', 404)
  return sanitizeInvitation(data)
}

export async function acceptOrganizationInvitation(input: {
  token: string
  auth_user_id: string
  email: string
  display_name?: string
}) {
  const tokenHash = hashInviteToken(input.token)
  const email = normalizeInviteEmail(input.email)

  if (isProvisioningTestMode()) {
    const invitation = findInvitationByTokenHash(tokenHash)
    if (!invitation) throw new AuthorizationError('Invitación inválida', 404)
    if (invitation.status !== 'pending') throw new AuthorizationError('Invitación no disponible', 409)
    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      updateTestInvitation(invitation.id, { status: 'expired' })
      throw new AuthorizationError('Invitación expirada', 410)
    }
    if (invitation.email_normalized !== email) {
      throw new AuthorizationError('Email no coincide con la invitación', 403)
    }

    const profileId = newProvisioningId()
    insertTestProfile({
      id: profileId,
      auth_user_id: input.auth_user_id,
      email,
      display_name: input.display_name ?? invitation.display_name,
      active_organization_id: invitation.organization_id,
      is_platform_admin: false,
      provisioning_status: 'active',
    })

    const membershipId = newProvisioningId()
    insertTestMembership(
      {
        id: membershipId,
        organization_id: invitation.organization_id,
        user_id: profileId,
        status: 'active',
        invited_at: invitation.created_at,
        joined_at: new Date().toISOString(),
        revoked_at: null,
      },
      invitation.proposed_roles,
    )

    updateTestInvitation(invitation.id, {
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })

    return { profile_id: profileId, membership_id: membershipId, organization_id: invitation.organization_id }
  }

  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const admin = getSupabaseAdmin()
  const { data: invitation } = await admin
    .from('organization_invitations')
    .select('*')
    .eq('token_hash', tokenHash)
    .eq('status', 'pending')
    .maybeSingle()

  if (!invitation || !inviteTokensMatch(input.token, String(invitation.token_hash))) {
    throw new AuthorizationError('Invitación inválida', 404)
  }
  if (new Date(String(invitation.expires_at)).getTime() < Date.now()) {
    await admin.from('organization_invitations').update({ status: 'expired' }).eq('id', invitation.id)
    throw new AuthorizationError('Invitación expirada', 410)
  }
  if (String(invitation.email_normalized) !== email) {
    throw new AuthorizationError('Email no coincide con la invitación', 403)
  }

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .insert({
      auth_user_id: input.auth_user_id,
      email,
      display_name: input.display_name ?? String(invitation.display_name),
      active_organization_id: invitation.organization_id,
      provisioning_status: 'active',
    })
    .select('id')
    .single()
  if (profileError) throw new Error(profileError.message)

  const { data: membership, error: membershipError } = await admin
    .from('organization_memberships')
    .insert({
      organization_id: invitation.organization_id,
      user_id: profile.id,
      status: 'active',
      invited_at: invitation.created_at,
      joined_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (membershipError) throw new Error(membershipError.message)

  const roles = (invitation.proposed_roles as TerramindRole[]) ?? ['viewer']
  assertAssignableRoles(roles)
  await admin.from('membership_roles').insert(
    roles.map((role_id) => ({ membership_id: membership.id, role_id })),
  )

  await admin
    .from('organization_invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  return {
    profile_id: String(profile.id),
    membership_id: String(membership.id),
    organization_id: String(invitation.organization_id),
  }
}

function sanitizeInvitation(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    email: String(row.email_normalized),
    display_name: String(row.display_name ?? ''),
    proposed_roles: (row.proposed_roles as TerramindRole[]) ?? [],
    status: String(row.status),
    invited_by_user_id: row.invited_by_user_id ? String(row.invited_by_user_id) : null,
    expires_at: String(row.expires_at),
    accepted_at: row.accepted_at ? String(row.accepted_at) : null,
    revoked_at: row.revoked_at ? String(row.revoked_at) : null,
    created_at: String(row.created_at),
  }
}

export function assertCanManageMembership(auth: RequestAuthContext, organizationId: string): void {
  if (auth.isPlatformAdmin) return
  if (auth.activeOrganizationId !== organizationId) {
    throw new AuthorizationError('Acceso cross-tenant denegado', 403)
  }
}

export { countOrgAdmins }
