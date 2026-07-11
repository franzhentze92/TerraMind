/** Hardcoded dev login — stripped from production builds via import.meta.env.DEV. */
import type { AuthMeResponse } from '@/core/auth/auth-session.types'
import type { RequestAuthContext, TerramindPermission } from '@/core/auth/permissions'

const TEST_ORG_A = '00000000-0000-4000-a07f-000000000001'

const ORG_ADMIN_PERMISSIONS = [
  'incidents.view',
  'findings.view',
  'priorities.view',
  'verification_plans.view',
  'missions.view',
  'missions.assign',
  'missions.accept',
  'missions.decline',
  'missions.start',
  'missions.block',
  'missions.complete',
  'missions.cancel',
  'evidence.submit',
  'evidence.view',
  'evidence.withdraw',
  'evidence.validate',
  'evidence.revalidate',
  'offline_packages.generate',
  'offline_packages.download',
  'offline_packages.revoke',
  'field_sync.execute',
  'field_sync.retry',
  'field_sync.resolve_conflict',
  'responses.view',
  'responses.assess',
  'responses.decide',
  'responses.approve',
  'responses.modify',
  'responses.reject',
  'response_actions.create',
  'response_actions.execute',
  'response_actions.complete',
  'notifications.prepare',
  'notifications.approve',
  'incident_closure.recommend',
  'users.invite',
  'memberships.manage',
  'roles.manage',
  'organization.settings',
] as const satisfies readonly TerramindPermission[]

const TECH_PERMISSIONS = [
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
] as const satisfies readonly TerramindPermission[]

export const DEV_LOGIN_ACCOUNTS = [
  {
    email: 'admin@terramind.dev',
    password: 'terramind-dev',
    token: 'test-org-admin-org-a',
    label: 'Admin organización (demo)',
    session: {
      state: 'active',
      context: {
        authUserId: '00000000-0000-4000-a07f-00000000a301',
        userId: '00000000-0000-4000-a07f-000000000301',
        activeOrganizationId: TEST_ORG_A,
        membershipId: '00000000-0000-4000-a07f-00000000m301',
        roles: ['organization_admin'],
        permissions: [...ORG_ADMIN_PERMISSIONS],
        isPlatformAdmin: false,
      } satisfies RequestAuthContext,
      profile: {
        id: '00000000-0000-4000-a07f-000000000301',
        email: 'admin@terramind.dev',
        display_name: 'Admin Demo',
        provisioning_status: 'active',
        is_platform_admin: false,
      },
      organizations: [
        {
          id: TEST_ORG_A,
          name: 'Organización Demo A',
          slug: 'org-demo-a',
          membership_status: 'active',
        },
      ],
    } satisfies AuthMeResponse,
  },
  {
    email: 'tecnico@terramind.dev',
    password: 'terramind-dev',
    token: 'test-tech-org-a',
    label: 'Técnico de campo (demo)',
    session: {
      state: 'active',
      context: {
        authUserId: '00000000-0000-4000-a07f-00000000a101',
        userId: '00000000-0000-4000-a07f-000000000101',
        activeOrganizationId: TEST_ORG_A,
        membershipId: '00000000-0000-4000-a07f-00000000m101',
        roles: ['field_technician'],
        permissions: [...TECH_PERMISSIONS],
        isPlatformAdmin: false,
      } satisfies RequestAuthContext,
      profile: {
        id: '00000000-0000-4000-a07f-000000000101',
        email: 'tecnico@terramind.dev',
        display_name: 'Técnico Demo',
        provisioning_status: 'active',
        is_platform_admin: false,
      },
      organizations: [
        {
          id: TEST_ORG_A,
          name: 'Organización Demo A',
          slug: 'org-demo-a',
          membership_status: 'active',
        },
      ],
    } satisfies AuthMeResponse,
  },
] as const

export function resolveDevLoginToken(email: string, password: string): string | null {
  if (!import.meta.env.DEV || import.meta.env.MODE === 'test') return null
  const normalized = email.trim().toLowerCase()
  const match = DEV_LOGIN_ACCOUNTS.find((a) => a.email === normalized && a.password === password)
  return match?.token ?? null
}

export function buildDevLoginSession(token: string): AuthMeResponse | null {
  if (!import.meta.env.DEV || import.meta.env.MODE === 'test') return null
  return DEV_LOGIN_ACCOUNTS.find((a) => a.token === token)?.session ?? null
}
