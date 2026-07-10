import type { RequestAuthContext, TerramindRole } from '@/core/auth/permissions'
import { AuthenticationError } from '@/core/auth/permissions'

export const TEST_ORG_A = '00000000-0000-4000-a07f-000000000001'
export const TEST_ORG_B = '00000000-0000-4000-a07f-000000000002'

export const TEST_USER_TECH_A = '00000000-0000-4000-a07f-000000000101'
export const TEST_USER_SUP_A = '00000000-0000-4000-a07f-000000000102'
export const TEST_USER_TECH_B = '00000000-0000-4000-a07f-000000000201'

export const TEST_AUTH_USER_TECH_A = '00000000-0000-4000-a07f-00000000a101'
export const TEST_AUTH_USER_SUP_A = '00000000-0000-4000-a07f-00000000a102'
export const TEST_AUTH_USER_TECH_B = '00000000-0000-4000-a07f-00000000a201'

export const TEST_MEMBERSHIP_TECH_A = '00000000-0000-4000-a07f-00000000m101'
export const TEST_MEMBERSHIP_SUP_A = '00000000-0000-4000-a07f-00000000m102'
export const TEST_MEMBERSHIP_TECH_B = '00000000-0000-4000-a07f-00000000m201'

export const TEST_MISSION_ORG_A = '00000000-0000-4000-a07f-00000000f001'
export const TEST_MISSION_ORG_B = '00000000-0000-4000-a07f-00000000f002'

export interface TestAuthFixture {
  token: string
  context: RequestAuthContext
}

const FIXTURES: TestAuthFixture[] = [
  {
    token: 'test-tech-org-a',
    context: {
      authUserId: TEST_AUTH_USER_TECH_A,
      userId: TEST_USER_TECH_A,
      activeOrganizationId: TEST_ORG_A,
      membershipId: TEST_MEMBERSHIP_TECH_A,
      roles: ['field_technician'],
      permissions: [
        'missions.view',
        'missions.accept',
        'missions.decline',
        'missions.start',
        'missions.complete',
        'evidence.submit',
        'evidence.view',
        'offline_packages.download',
        'field_sync.execute',
        'field_sync.retry',
      ],
      isPlatformAdmin: false,
    },
  },
  {
    token: 'test-supervisor-org-a',
    context: {
      authUserId: TEST_AUTH_USER_SUP_A,
      userId: TEST_USER_SUP_A,
      activeOrganizationId: TEST_ORG_A,
      membershipId: TEST_MEMBERSHIP_SUP_A,
      roles: ['field_supervisor'],
      permissions: [
        'missions.view',
        'missions.assign',
        'missions.accept',
        'missions.start',
        'missions.block',
        'missions.complete',
        'evidence.view',
        'evidence.submit',
        'offline_packages.download',
        'offline_packages.revoke',
        'field_sync.execute',
        'field_sync.retry',
        'field_sync.resolve_conflict',
      ],
      isPlatformAdmin: false,
    },
  },
  {
    token: 'test-tech-org-b',
    context: {
      authUserId: TEST_AUTH_USER_TECH_B,
      userId: TEST_USER_TECH_B,
      activeOrganizationId: TEST_ORG_B,
      membershipId: TEST_MEMBERSHIP_TECH_B,
      roles: ['field_technician'],
      permissions: [
        'missions.view',
        'missions.accept',
        'missions.start',
        'missions.complete',
        'evidence.submit',
        'evidence.view',
        'offline_packages.download',
        'field_sync.execute',
        'field_sync.retry',
      ],
      isPlatformAdmin: false,
    },
  },
  {
    token: 'test-suspended',
    context: {
      authUserId: '00000000-0000-4000-a07f-00000000a999',
      userId: '00000000-0000-4000-a07f-000000000999',
      activeOrganizationId: TEST_ORG_A,
      membershipId: '00000000-0000-4000-a07f-00000000m999',
      roles: ['field_technician'],
      permissions: [],
      isPlatformAdmin: false,
    },
  },
]

const SUSPENDED_TOKENS = new Set(['test-suspended'])
const REVOKED_TOKENS = new Set(['test-revoked'])

export function resolveTestAuthToken(bearer: string): RequestAuthContext | null {
  if (REVOKED_TOKENS.has(bearer)) return null
  if (SUSPENDED_TOKENS.has(bearer)) {
    throw new AuthenticationError('Membership suspended')
  }
  const fixture = FIXTURES.find((f) => f.token === bearer)
  if (!fixture) return null
  return fixture.context
}

export function testBearerForRole(role: TerramindRole, org: 'a' | 'b' = 'a'): string {
  if (role === 'field_supervisor' && org === 'a') return 'test-supervisor-org-a'
  if (role === 'field_technician' && org === 'b') return 'test-tech-org-b'
  return 'test-tech-org-a'
}
