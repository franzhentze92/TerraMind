import type { TerramindRole } from '@/core/auth/permissions'
import {
  TEST_AUTH_USER_SUP_A,
  TEST_AUTH_USER_TECH_A,
  TEST_AUTH_USER_TECH_B,
  TEST_MEMBERSHIP_SUP_A,
  TEST_MEMBERSHIP_TECH_A,
  TEST_MEMBERSHIP_TECH_B,
  TEST_ORG_A,
  TEST_ORG_B,
  TEST_USER_SUP_A,
  TEST_USER_TECH_A,
  TEST_USER_TECH_B,
} from './test-fixtures.js'
import {
  TEST_AUTH_USER_ORG_ADMIN_A,
  TEST_MEMBERSHIP_ORG_ADMIN_A,
  TEST_USER_ORG_ADMIN_A,
} from './provisioning-test-fixtures.js'

export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'revoked'
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'
export type ProvisioningStatus = 'active' | 'awaiting_access' | 'suspended'

export interface TestOrganization {
  id: string
  slug: string
  name: string
  status: 'active' | 'suspended'
}

export interface TestUserProfile {
  id: string
  auth_user_id: string
  email: string
  display_name: string
  active_organization_id: string | null
  is_platform_admin: boolean
  provisioning_status: ProvisioningStatus
}

export interface TestMembership {
  id: string
  organization_id: string
  user_id: string
  status: MembershipStatus
  invited_at: string | null
  joined_at: string | null
  revoked_at: string | null
}

export interface TestInvitation {
  id: string
  organization_id: string
  email_normalized: string
  display_name: string
  proposed_roles: TerramindRole[]
  token_hash: string
  status: InvitationStatus
  invited_by_user_id: string | null
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
  created_at: string
}

const organizations = new Map<string, TestOrganization>()
const profiles = new Map<string, TestUserProfile>()
const memberships = new Map<string, TestMembership>()
const membershipRoles = new Map<string, Set<TerramindRole>>()
const invitations = new Map<string, TestInvitation>()
let bootstrapCompleted = false
let bootstrapAuthUserId: string | null = null

function seedDefaults() {
  if (organizations.size > 0) return
  organizations.set(TEST_ORG_A, { id: TEST_ORG_A, slug: 'org-a', name: 'Organización A', status: 'active' })
  organizations.set(TEST_ORG_B, { id: TEST_ORG_B, slug: 'org-b', name: 'Organización B', status: 'active' })

  profiles.set(TEST_USER_ORG_ADMIN_A, {
    id: TEST_USER_ORG_ADMIN_A,
    auth_user_id: TEST_AUTH_USER_ORG_ADMIN_A,
    email: 'admin@org-a.test',
    display_name: 'Admin Org A',
    active_organization_id: TEST_ORG_A,
    is_platform_admin: false,
    provisioning_status: 'active',
  })

  memberships.set(TEST_MEMBERSHIP_ORG_ADMIN_A, {
    id: TEST_MEMBERSHIP_ORG_ADMIN_A,
    organization_id: TEST_ORG_A,
    user_id: TEST_USER_ORG_ADMIN_A,
    status: 'active',
    invited_at: null,
    joined_at: new Date().toISOString(),
    revoked_at: null,
  })
  membershipRoles.set(TEST_MEMBERSHIP_ORG_ADMIN_A, new Set(['organization_admin']))

  const techProfiles = [
    {
      id: TEST_USER_TECH_A,
      auth_user_id: TEST_AUTH_USER_TECH_A,
      email: 'tech-a@test.com',
      display_name: 'Tech A',
      active_organization_id: TEST_ORG_A,
      is_platform_admin: false,
      provisioning_status: 'active' as const,
    },
    {
      id: TEST_USER_SUP_A,
      auth_user_id: TEST_AUTH_USER_SUP_A,
      email: 'supervisor-a@test.com',
      display_name: 'Supervisor A',
      active_organization_id: TEST_ORG_A,
      is_platform_admin: false,
      provisioning_status: 'active' as const,
    },
    {
      id: TEST_USER_TECH_B,
      auth_user_id: TEST_AUTH_USER_TECH_B,
      email: 'tech-b@test.com',
      display_name: 'Tech B',
      active_organization_id: TEST_ORG_B,
      is_platform_admin: false,
      provisioning_status: 'active' as const,
    },
  ]
  for (const profile of techProfiles) profiles.set(profile.id, profile)

  memberships.set(TEST_MEMBERSHIP_TECH_A, {
    id: TEST_MEMBERSHIP_TECH_A,
    organization_id: TEST_ORG_A,
    user_id: TEST_USER_TECH_A,
    status: 'active',
    invited_at: null,
    joined_at: new Date().toISOString(),
    revoked_at: null,
  })
  membershipRoles.set(TEST_MEMBERSHIP_TECH_A, new Set(['field_technician']))
  memberships.set(TEST_MEMBERSHIP_SUP_A, {
    id: TEST_MEMBERSHIP_SUP_A,
    organization_id: TEST_ORG_A,
    user_id: TEST_USER_SUP_A,
    status: 'active',
    invited_at: null,
    joined_at: new Date().toISOString(),
    revoked_at: null,
  })
  membershipRoles.set(TEST_MEMBERSHIP_SUP_A, new Set(['field_supervisor']))
  memberships.set(TEST_MEMBERSHIP_TECH_B, {
    id: TEST_MEMBERSHIP_TECH_B,
    organization_id: TEST_ORG_B,
    user_id: TEST_USER_TECH_B,
    status: 'active',
    invited_at: null,
    joined_at: new Date().toISOString(),
    revoked_at: null,
  })
  membershipRoles.set(TEST_MEMBERSHIP_TECH_B, new Set(['field_technician']))
}

seedDefaults()

export function resetProvisioningTestStore(): void {
  organizations.clear()
  profiles.clear()
  memberships.clear()
  membershipRoles.clear()
  invitations.clear()
  bootstrapCompleted = false
  bootstrapAuthUserId = null
  seedDefaults()
}

export function isProvisioningTestMode(): boolean {
  return process.env.AUTH_TEST_MODE === '1' || process.env.NODE_ENV === 'test'
}

export function getTestOrganizations(): TestOrganization[] {
  return [...organizations.values()]
}

export function getTestProfileByAuthUserId(authUserId: string): TestUserProfile | null {
  return [...profiles.values()].find((p) => p.auth_user_id === authUserId) ?? null
}

export function getTestProfileById(id: string): TestUserProfile | null {
  return profiles.get(id) ?? null
}

export function getTestMembership(userId: string, organizationId: string): TestMembership | null {
  return (
    [...memberships.values()].find(
      (m) => m.user_id === userId && m.organization_id === organizationId,
    ) ?? null
  )
}

export function listTestMembershipsForUser(userId: string): TestMembership[] {
  return [...memberships.values()].filter((m) => m.user_id === userId && m.status !== 'revoked')
}

export function getTestMembershipRoles(membershipId: string): TerramindRole[] {
  return [...(membershipRoles.get(membershipId) ?? [])]
}

export function listTestMembers(organizationId: string): Array<TestMembership & { profile: TestUserProfile; roles: TerramindRole[] }> {
  return [...memberships.values()]
    .filter((m) => m.organization_id === organizationId)
    .map((m) => {
      const profile = profiles.get(m.user_id)
      if (!profile) return null
      return { ...m, profile, roles: getTestMembershipRoles(m.id) }
    })
    .filter(Boolean) as Array<TestMembership & { profile: TestUserProfile; roles: TerramindRole[] }>
}

export function listTestInvitations(organizationId: string): TestInvitation[] {
  return [...invitations.values()].filter((i) => i.organization_id === organizationId)
}

export function getTestInvitationById(id: string): TestInvitation | null {
  return invitations.get(id) ?? null
}

export function findPendingInvitationByEmail(organizationId: string, email: string): TestInvitation | null {
  const normalized = email.trim().toLowerCase()
  return (
    [...invitations.values()].find(
      (i) =>
        i.organization_id === organizationId &&
        i.email_normalized === normalized &&
        i.status === 'pending',
    ) ?? null
  )
}

export function findInvitationByTokenHash(tokenHash: string): TestInvitation | null {
  return [...invitations.values()].find((i) => i.token_hash === tokenHash && i.status === 'pending') ?? null
}

export function insertTestProfile(profile: TestUserProfile): void {
  profiles.set(profile.id, profile)
}

export function insertTestMembership(membership: TestMembership, roles: TerramindRole[]): void {
  memberships.set(membership.id, membership)
  membershipRoles.set(membership.id, new Set(roles))
}

export function insertTestInvitation(invitation: TestInvitation): void {
  invitations.set(invitation.id, invitation)
}

export function updateTestProfile(id: string, patch: Partial<TestUserProfile>): TestUserProfile | null {
  const current = profiles.get(id)
  if (!current) return null
  const next = { ...current, ...patch }
  profiles.set(id, next)
  return next
}

export function updateTestMembership(id: string, patch: Partial<TestMembership>): TestMembership | null {
  const current = memberships.get(id)
  if (!current) return null
  const next = { ...current, ...patch }
  memberships.set(id, next)
  return next
}

export function updateTestInvitation(id: string, patch: Partial<TestInvitation>): TestInvitation | null {
  const current = invitations.get(id)
  if (!current) return null
  const next = { ...current, ...patch }
  invitations.set(id, next)
  return next
}

export function setTestMembershipRoles(membershipId: string, roles: TerramindRole[]): void {
  membershipRoles.set(membershipId, new Set(roles))
}

export function addTestMembershipRole(membershipId: string, role: TerramindRole): void {
  const set = membershipRoles.get(membershipId) ?? new Set<TerramindRole>()
  set.add(role)
  membershipRoles.set(membershipId, set)
}

export function removeTestMembershipRole(membershipId: string, role: TerramindRole): void {
  const set = membershipRoles.get(membershipId)
  if (!set) return
  set.delete(role)
}

export function countOrgAdmins(organizationId: string): number {
  return listTestMembers(organizationId).filter(
    (m) => m.status === 'active' && m.roles.includes('organization_admin'),
  ).length
}

export function isBootstrapCompleted(): boolean {
  return bootstrapCompleted
}

export function markBootstrapCompleted(authUserId: string): void {
  bootstrapCompleted = true
  bootstrapAuthUserId = authUserId
}

export function getBootstrapAuthUserId(): string | null {
  return bootstrapAuthUserId
}

export function insertTestOrganization(org: TestOrganization): void {
  organizations.set(org.id, org)
}
