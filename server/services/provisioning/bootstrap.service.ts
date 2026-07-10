import { randomUUID } from 'node:crypto'

import {
  getBootstrapAuthUserId,
  insertTestMembership,
  insertTestOrganization,
  insertTestProfile,
  isBootstrapCompleted,
  isProvisioningTestMode,
  markBootstrapCompleted,
} from '../../auth/provisioning-test-store.js'
import { newProvisioningId } from './session.service.js'

export interface BootstrapInput {
  auth_user_id: string
  email: string
  display_name?: string
  organization_name?: string
  organization_slug?: string
  bootstrap_token?: string
}

export interface BootstrapResult {
  ok: boolean
  already_completed?: boolean
  organization_id?: string
  user_profile_id?: string
  membership_id?: string
}

function expectedBootstrapToken(): string | null {
  return process.env.AUTH_BOOTSTRAP_TOKEN?.trim() || null
}

function expectedBootstrapAuthUserId(): string | null {
  return process.env.AUTH_BOOTSTRAP_AUTH_USER_ID?.trim() || null
}

export function isBootstrapEnabled(): boolean {
  return Boolean(expectedBootstrapToken() && expectedBootstrapAuthUserId())
}

export async function runPlatformBootstrap(input: BootstrapInput): Promise<BootstrapResult> {
  const token = expectedBootstrapToken()
  const allowedAuthUserId = expectedBootstrapAuthUserId()
  if (!token || !allowedAuthUserId) {
    throw new Error('bootstrap_disabled')
  }
  if (input.bootstrap_token !== token) {
    throw new Error('bootstrap_token_invalid')
  }
  if (input.auth_user_id !== allowedAuthUserId) {
    throw new Error('bootstrap_auth_user_not_allowed')
  }

  if (isProvisioningTestMode()) {
    if (isBootstrapCompleted()) {
      return { ok: true, already_completed: true, organization_id: undefined }
    }
    const orgId = newProvisioningId()
    insertTestOrganization({
      id: orgId,
      slug: input.organization_slug ?? 'terramind-platform',
      name: input.organization_name ?? 'TerraMind Platform',
      status: 'active',
    })
    const profileId = newProvisioningId()
    insertTestProfile({
      id: profileId,
      auth_user_id: input.auth_user_id,
      email: input.email.trim().toLowerCase(),
      display_name: input.display_name ?? 'Platform Admin',
      active_organization_id: orgId,
      is_platform_admin: true,
      provisioning_status: 'active',
    })
    const membershipId = newProvisioningId()
    insertTestMembership(
      {
        id: membershipId,
        organization_id: orgId,
        user_id: profileId,
        status: 'active',
        invited_at: null,
        joined_at: new Date().toISOString(),
        revoked_at: null,
      },
      ['platform_admin', 'organization_admin'],
    )
    markBootstrapCompleted(input.auth_user_id)
    return {
      ok: true,
      organization_id: orgId,
      user_profile_id: profileId,
      membership_id: membershipId,
    }
  }

  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const admin = getSupabaseAdmin()

  const { data: existingBootstrap } = await admin
    .from('platform_bootstrap_runs')
    .select('id')
    .limit(1)
    .maybeSingle()
  if (existingBootstrap) {
    return { ok: true, already_completed: true }
  }

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({
      slug: input.organization_slug ?? 'terramind-platform',
      name: input.organization_name ?? 'TerraMind Platform',
      status: 'active',
    })
    .select('id')
    .single()
  if (orgError) throw new Error(orgError.message)

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .insert({
      auth_user_id: input.auth_user_id,
      email: input.email.trim().toLowerCase(),
      display_name: input.display_name ?? 'Platform Admin',
      active_organization_id: org.id,
      is_platform_admin: true,
      provisioning_status: 'active',
    })
    .select('id')
    .single()
  if (profileError) throw new Error(profileError.message)

  const { data: membership, error: membershipError } = await admin
    .from('organization_memberships')
    .insert({
      organization_id: org.id,
      user_id: profile.id,
      status: 'active',
      joined_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (membershipError) throw new Error(membershipError.message)

  await admin.from('membership_roles').insert([
    { membership_id: membership.id, role_id: 'platform_admin' },
    { membership_id: membership.id, role_id: 'organization_admin' },
  ])

  await admin.from('platform_bootstrap_runs').insert({
    auth_user_id: input.auth_user_id,
    organization_id: org.id,
    user_profile_id: profile.id,
    metadata: { source: 'auth:bootstrap-admin' },
  })

  return {
    ok: true,
    organization_id: String(org.id),
    user_profile_id: String(profile.id),
    membership_id: String(membership.id),
  }
}

export function getBootstrapStatus() {
  return {
    enabled: isBootstrapEnabled(),
    completed: isProvisioningTestMode() ? isBootstrapCompleted() : null,
    allowed_auth_user_id: expectedBootstrapAuthUserId(),
    bootstrapped_auth_user_id: isProvisioningTestMode() ? getBootstrapAuthUserId() : null,
  }
}

export function generateBootstrapOrgSlug(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${randomUUID().slice(0, 8)}`
}
