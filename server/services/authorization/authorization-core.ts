import type {
  AuthorizedResourceContext,
  RequestAuthContext,
  TerramindPermission,
} from '@/core/auth/permissions'
import { AuthorizationError, assertPermission } from '@/core/auth/permissions'

export interface TenantScopedResource {
  id: string
  organization_id: string | null
}

export function assertSameOrganization(
  auth: RequestAuthContext,
  resource: TenantScopedResource,
): void {
  if (auth.isPlatformAdmin) return
  if (!resource.organization_id) {
    throw new AuthorizationError('Recurso sin organización asignada', 403)
  }
  if (resource.organization_id !== auth.activeOrganizationId) {
    throw new AuthorizationError('Acceso cross-tenant denegado', 403)
  }
}

export function buildAuthorizedResourceContext(
  auth: RequestAuthContext,
  resourceType: string,
  resource: TenantScopedResource,
): AuthorizedResourceContext {
  assertSameOrganization(auth, resource)
  return {
    ...auth,
    resourceType,
    resourceId: resource.id,
    organizationId: resource.organization_id ?? auth.activeOrganizationId,
    authorizedAt: new Date().toISOString(),
  }
}

export function authorizeWithPermission(
  auth: RequestAuthContext,
  permission: TerramindPermission,
  resource: TenantScopedResource,
  resourceType: string,
): AuthorizedResourceContext {
  assertPermission(auth, permission)
  return buildAuthorizedResourceContext(auth, resourceType, resource)
}
