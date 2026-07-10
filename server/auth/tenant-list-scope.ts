import type { RequestAuthContext } from '@/core/auth/permissions'

export interface TenantScopedRow {
  organization_id?: string | null
}

/** Server-side tenant filter for list endpoints (8B.7F.2). */
export function filterRowsByActiveOrganization<T extends TenantScopedRow>(
  auth: RequestAuthContext,
  rows: T[],
): T[] {
  if (auth.isPlatformAdmin) return rows
  return rows.filter(
    (row) =>
      row.organization_id != null && row.organization_id === auth.activeOrganizationId,
  )
}

export function organizationListFilter(auth: RequestAuthContext): {
  organization_id: string
} {
  return { organization_id: auth.activeOrganizationId }
}
