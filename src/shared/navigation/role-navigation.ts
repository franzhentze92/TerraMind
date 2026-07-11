/**
 * Role- and permission-aware navigation visibility — Phase 2.
 */
import type { RequestAuthContext, TerramindPermission, TerramindRole } from '@/core/auth/permissions'
import type { RouteRegistryEntry } from './navigation-registry'

const OPERATIONAL_ROLES: TerramindRole[] = [
  'platform_admin',
  'organization_admin',
  'operations_coordinator',
  'field_supervisor',
  'analyst',
]

/** Field technician with no operational role sees a reduced Campo-first experience. */
export function isFieldTechnicianOnly(ctx: RequestAuthContext | null): boolean {
  if (!ctx) return false
  if (!ctx.roles.includes('field_technician')) return false
  return !ctx.roles.some((r) => OPERATIONAL_ROLES.includes(r))
}

/** Viewer-only users (no write/ops roles) — read-mostly national experience. */
export function isViewerOnly(ctx: RequestAuthContext | null): boolean {
  if (!ctx) return false
  if (ctx.isPlatformAdmin) return false
  if (ctx.roles.includes('viewer') && ctx.roles.length === 1) return true
  return ctx.roles.includes('viewer') && !ctx.roles.some((r) => OPERATIONAL_ROLES.includes(r) || r === 'field_supervisor')
}

function hasPermission(ctx: RequestAuthContext | null, permission: TerramindPermission): boolean {
  if (!ctx) return false
  if (ctx.isPlatformAdmin) return true
  return ctx.permissions.includes(permission)
}

function hasAnyPermission(ctx: RequestAuthContext | null, permissions: TerramindPermission[]): boolean {
  return permissions.some((p) => hasPermission(ctx, p))
}

export function canSeeRoute(entry: RouteRegistryEntry, ctx: RequestAuthContext | null): boolean {
  if (entry.status === 'hidden' || entry.status === 'deprecated' || entry.navLevel === 'alias') {
    return false
  }
  if (entry.onlyForRoles?.length) {
    if (!ctx?.roles.some((r) => entry.onlyForRoles!.includes(r))) return false
  }
  if (entry.hiddenForRoles?.length && ctx?.roles.some((r) => entry.hiddenForRoles!.includes(r))) {
    if (!ctx.isPlatformAdmin) return false
  }

  // Field technician-only: Campo section + field missions path
  if (isFieldTechnicianOnly(ctx)) {
    if (entry.section === 'campo') return true
    if (entry.path === '/misiones' && hasPermission(ctx, 'missions.view')) return false
    return false
  }

  if (entry.permission && !hasPermission(ctx, entry.permission)) return false
  if (entry.anyPermission?.length && !hasAnyPermission(ctx, entry.anyPermission)) return false

  // Viewer: no Campo, no Administración (unless platform admin)
  if (isViewerOnly(ctx)) {
    if (entry.section === 'campo' || entry.section === 'administracion') return false
    if (entry.path === '/copilot') return false
  }

  // Analyst: no admin section
  if (ctx?.roles.includes('analyst') && !ctx.isPlatformAdmin && !ctx.roles.includes('organization_admin')) {
    if (entry.section === 'administracion') return false
    if (entry.section === 'campo' && !hasAnyPermission(ctx, ['offline_packages.download', 'field_sync.execute'])) {
      return false
    }
  }

  return true
}

export function canSeeNavItem(entry: RouteRegistryEntry, ctx: RequestAuthContext | null): boolean {
  return entry.navLevel === 'primary' && canSeeRoute(entry, ctx)
}
