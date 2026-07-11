import { useAuth } from '@/core/auth/AuthProvider'
import type { TerramindPermission } from '@/core/auth/permissions'
import { ROUTE_REGISTRY } from '@/shared/navigation/navigation-registry'
import { canSeeRoute } from '@/shared/navigation/role-navigation'

export function useSituationRouteAccess(path: string): boolean {
  const { authContext } = useAuth()
  const entry = ROUTE_REGISTRY.find((r) => r.path === path)
  if (!entry) return false
  return canSeeRoute(entry, authContext)
}

export function useSituationPermission(permission: TerramindPermission): boolean {
  const { authContext } = useAuth()
  if (!authContext) return false
  if (authContext.isPlatformAdmin) return true
  return authContext.permissions.includes(permission)
}
