import { describe, expect, it, beforeEach } from 'vitest'

import { AuthorizationError } from '@/core/auth/permissions'
import { clearAuthAuditBuffer, drainAuthAuditBuffer } from '../services/auth-audit.service.js'
import { resetProvisioningTestStore } from './provisioning-test-store.js'
import { resolveTestAuthToken } from './test-fixtures.js'
import { TEST_ORG_A, TEST_ORG_B } from './test-fixtures.js'
import { runPlatformBootstrap, getBootstrapStatus } from '../services/provisioning/bootstrap.service.js'
import {
  acceptOrganizationInvitation,
  createOrganizationInvitation,
  revokeOrganizationInvitation,
} from '../services/provisioning/invitation.service.js'
import {
  listOrganizationMembers,
  revokeOrganizationMembership,
  suspendOrganizationMembership,
  reactivateOrganizationMembership,
  assignOrganizationRole,
} from '../services/provisioning/membership-admin.service.js'
import { buildAuthSessionPayload } from '../services/provisioning/session.service.js'
import { generateInviteToken, hashInviteToken } from '../services/provisioning/invite-token.js'
import {
  findInvitationByTokenHash,
  getTestInvitationById,
  insertTestInvitation,
  updateTestInvitation,
} from './provisioning-test-store.js'
import { TEST_AUTH_USER_ORG_ADMIN_A } from './provisioning-test-fixtures.js'

process.env.AUTH_TEST_MODE = '1'
process.env.AUTH_ENFORCE = 'true'

describe('provisioning — 8B.7F.3', () => {
  beforeEach(() => {
    process.env.AUTH_TEST_MODE = '1'
    process.env.AUTH_ENFORCE = 'true'
    resetProvisioningTestStore()
    clearAuthAuditBuffer()
  })

  it('bootstrap succeeds once and rejects second unauthorized attempt', async () => {
    process.env.AUTH_BOOTSTRAP_TOKEN = 'bootstrap-secret'
    process.env.AUTH_BOOTSTRAP_AUTH_USER_ID = 'auth-bootstrap-1'

    const first = await runPlatformBootstrap({
      auth_user_id: 'auth-bootstrap-1',
      email: 'admin@terramind.test',
      bootstrap_token: 'bootstrap-secret',
    })
    expect(first.ok).toBe(true)
    expect(first.already_completed).toBeFalsy()

    const second = await runPlatformBootstrap({
      auth_user_id: 'auth-bootstrap-1',
      email: 'admin@terramind.test',
      bootstrap_token: 'bootstrap-secret',
    })
    expect(second.already_completed).toBe(true)

    await expect(
      runPlatformBootstrap({
        auth_user_id: 'auth-bootstrap-2',
        email: 'other@test.com',
        bootstrap_token: 'bootstrap-secret',
      }),
    ).rejects.toThrow(/bootstrap_auth_user_not_allowed/)

    delete process.env.AUTH_BOOTSTRAP_TOKEN
    delete process.env.AUTH_BOOTSTRAP_AUTH_USER_ID
  })

  it('user without profile is awaiting_access', async () => {
    const session = await buildAuthSessionPayload('unknown-auth-user')
    expect(session.state).toBe('awaiting_access')
    expect(session.context).toBeNull()
  })

  it('organization admin can invite within tenant', async () => {
    const admin = resolveTestAuthToken('test-org-admin-org-a')!
    const created = await createOrganizationInvitation(admin, {
      email: 'new.user@org-a.test',
      roles: ['viewer'],
    })
    expect(created.invitation.email).toBe('new.user@org-a.test')
    expect(created.accept_url).toContain('invite=')
    expect(created.invitation.proposed_roles).toContain('viewer')
  })

  it('organization admin cannot invite with platform_admin role', async () => {
    const admin = resolveTestAuthToken('test-org-admin-org-a')!
    await expect(
      createOrganizationInvitation(admin, {
        email: 'bad@org-a.test',
        roles: ['platform_admin'],
      }),
    ).rejects.toBeInstanceOf(AuthorizationError)
  })

  it('invitation token is stored hashed only', async () => {
    const admin = resolveTestAuthToken('test-org-admin-org-a')!
    const raw = generateInviteToken()
    insertTestInvitation({
      id: '00000000-0000-4000-a07f-00000000i001',
      organization_id: TEST_ORG_A,
      email_normalized: 'token@test.com',
      display_name: 'Token User',
      proposed_roles: ['viewer'],
      token_hash: hashInviteToken(raw),
      status: 'pending',
      invited_by_user_id: admin.userId,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      accepted_at: null,
      revoked_at: null,
      created_at: new Date().toISOString(),
    })
    const row = getTestInvitationById('00000000-0000-4000-a07f-00000000i001')!
    expect(row.token_hash).not.toBe(raw)
    expect(findInvitationByTokenHash(hashInviteToken(raw))).toBeTruthy()
  })

  it('valid invitation creates profile and membership on accept', async () => {
    const admin = resolveTestAuthToken('test-org-admin-org-a')!
    const created = await createOrganizationInvitation(admin, {
      email: 'accepted@org-a.test',
      roles: ['field_technician'],
    })
    const token = created.accept_url!.split('invite=')[1]!
    const decoded = decodeURIComponent(token)
    const result = await acceptOrganizationInvitation({
      token: decoded,
      auth_user_id: '00000000-0000-4000-a07f-00000000a777',
      email: 'accepted@org-a.test',
    })
    expect(result.organization_id).toBe(TEST_ORG_A)
    const session = await buildAuthSessionPayload('00000000-0000-4000-a07f-00000000a777')
    expect(session.state).toBe('active')
  })

  it('expired invitation fails', async () => {
    const admin = resolveTestAuthToken('test-org-admin-org-a')!
    const raw = generateInviteToken()
    const id = '00000000-0000-4000-a07f-00000000i002'
    insertTestInvitation({
      id,
      organization_id: TEST_ORG_A,
      email_normalized: 'expired@test.com',
      display_name: 'Expired',
      proposed_roles: ['viewer'],
      token_hash: hashInviteToken(raw),
      status: 'pending',
      invited_by_user_id: admin.userId,
      expires_at: new Date(Date.now() - 1000).toISOString(),
      accepted_at: null,
      revoked_at: null,
      created_at: new Date().toISOString(),
    })
    await expect(
      acceptOrganizationInvitation({
        token: raw,
        auth_user_id: '00000000-0000-4000-a07f-00000000a888',
        email: 'expired@test.com',
      }),
    ).rejects.toBeInstanceOf(AuthorizationError)
    expect(getTestInvitationById(id)?.status).toBe('expired')
  })

  it('revoked invitation fails', async () => {
    const admin = resolveTestAuthToken('test-org-admin-org-a')!
    const created = await createOrganizationInvitation(admin, {
      email: 'revoked@org-a.test',
      roles: ['viewer'],
    })
    await revokeOrganizationInvitation(admin, created.invitation.id)
    const token = created.accept_url!.split('invite=')[1]!
    await expect(
      acceptOrganizationInvitation({
        token: decodeURIComponent(token),
        auth_user_id: '00000000-0000-4000-a07f-00000000a889',
        email: 'revoked@org-a.test',
      }),
    ).rejects.toBeInstanceOf(AuthorizationError)
  })

  it('suspension blocks session context on next resolve', async () => {
    const admin = resolveTestAuthToken('test-org-admin-org-a')!
    const members = await listOrganizationMembers(admin)
    const tech = members.find((m) => m.email.includes('tech')) ?? members[0]
    await suspendOrganizationMembership(admin, tech.membership_id)
    const session = await buildAuthSessionPayload(resolveTestAuthToken('test-tech-org-a')!.authUserId)
    expect(session.state).toBe('suspended')
    expect(session.context).toBeNull()
    await reactivateOrganizationMembership(admin, tech.membership_id)
  })

  it('cannot revoke last organization admin', async () => {
    const admin = resolveTestAuthToken('test-org-admin-org-a')!
    await expect(revokeOrganizationMembership(admin, admin.membershipId)).rejects.toBeInstanceOf(
      AuthorizationError,
    )
  })

  it('cannot assign platform_admin from org admin', async () => {
    const admin = resolveTestAuthToken('test-org-admin-org-a')!
    const members = await listOrganizationMembers(admin)
    const target = members.find((m) => m.membership_id !== admin.membershipId)!
    await expect(
      assignOrganizationRole(admin, target.membership_id, 'platform_admin'),
    ).rejects.toBeInstanceOf(AuthorizationError)
  })

  it('bootstrap status reflects enabled flag', () => {
    delete process.env.AUTH_BOOTSTRAP_TOKEN
    expect(getBootstrapStatus().enabled).toBe(false)
    process.env.AUTH_BOOTSTRAP_TOKEN = 'x'
    process.env.AUTH_BOOTSTRAP_AUTH_USER_ID = TEST_AUTH_USER_ORG_ADMIN_A
    expect(getBootstrapStatus().enabled).toBe(true)
    delete process.env.AUTH_BOOTSTRAP_TOKEN
    delete process.env.AUTH_BOOTSTRAP_AUTH_USER_ID
  })
})
