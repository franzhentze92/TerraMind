/**
 * TerraMind operational permissions (8B.7F).
 * Shared between server authorization and frontend UI gating.
 */
export const TERRAMIND_PERMISSIONS = [
  'incidents.view',
  'findings.view',
  'priorities.view',
  'news.view',
  'news.manage_sources',
  'news.run_ingestion',
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
] as const

export type TerramindPermission = (typeof TERRAMIND_PERMISSIONS)[number]

export const TERRAMIND_ROLES = [
  'platform_admin',
  'organization_admin',
  'operations_coordinator',
  'field_supervisor',
  'field_technician',
  'analyst',
  'viewer',
] as const

export type TerramindRole = (typeof TERRAMIND_ROLES)[number]

export const MEMBERSHIP_STATUSES = ['invited', 'active', 'suspended', 'revoked'] as const
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number]

export interface RequestAuthContext {
  authUserId: string
  userId: string
  activeOrganizationId: string
  membershipId: string
  roles: TerramindRole[]
  permissions: TerramindPermission[]
  isPlatformAdmin: boolean
}

export interface AuthorizedResourceContext extends RequestAuthContext {
  resourceType: string
  resourceId: string
  organizationId: string
  authorizedAt: string
}

export function hasTerramindPermission(
  permissions: readonly string[],
  required: TerramindPermission,
): boolean {
  return permissions.includes(required)
}

/** Platform admin bypass when explicitly allowed by caller. */
export function hasPermissionOrPlatformAdmin(
  ctx: Pick<RequestAuthContext, 'permissions' | 'isPlatformAdmin'>,
  required: TerramindPermission,
): boolean {
  if (ctx.isPlatformAdmin) return true
  return hasTerramindPermission(ctx.permissions, required)
}

export function assertPermission(
  ctx: Pick<RequestAuthContext, 'permissions' | 'isPlatformAdmin'>,
  required: TerramindPermission,
): void {
  if (!hasPermissionOrPlatformAdmin(ctx, required)) {
    throw new AuthorizationError(`Permiso requerido: ${required}`, 403)
  }
}

export class AuthorizationError extends Error {
  readonly status: number
  constructor(message: string, status = 403) {
    super(message)
    this.name = 'AuthorizationError'
    this.status = status
  }
}

export class AuthenticationError extends Error {
  readonly status = 401
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'AuthenticationError'
  }
}
