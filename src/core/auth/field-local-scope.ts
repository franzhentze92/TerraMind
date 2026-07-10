import { getFieldLocalIdentityKey, useAuthStore } from '@/core/auth/auth.store'

export interface FieldLocalTenantScope {
  organization_id: string
  user_id: string
  membership_id: string
}

export function getActiveFieldLocalScope(): FieldLocalTenantScope | null {
  const ctx = useAuthStore.getState().authContext
  if (!ctx) return null
  return {
    organization_id: ctx.activeOrganizationId,
    user_id: ctx.userId,
    membership_id: ctx.membershipId,
  }
}

export function assertFieldLocalScopeMatch(record: {
  organization_id?: string | null
  user_id?: string | null
}): boolean {
  const scope = getActiveFieldLocalScope()
  if (!scope) return false
  if (record.organization_id && record.organization_id !== scope.organization_id) return false
  if (record.user_id && record.user_id !== scope.user_id) return false
  return true
}

export function fieldLocalDbName(base: string): string {
  const key = getFieldLocalIdentityKey(useAuthStore.getState().authContext)
  return key ? `${base}-${key.replace(/:/g, '-')}` : `${base}-anonymous`
}

export function attachFieldLocalScope<T extends Record<string, unknown>>(record: T): T & FieldLocalTenantScope {
  const scope = getActiveFieldLocalScope()
  if (!scope) throw new Error('field_local_scope_required')
  return { ...record, ...scope }
}
