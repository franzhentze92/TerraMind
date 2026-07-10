import type { SupabaseClient } from '@supabase/supabase-js'

import type { AuthorizedResourceContext } from '@/core/auth/permissions'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client.js'

/**
 * Service role may only be used after resource authorization (8B.7F).
 */
export function getAuthorizedAdminClient(ctx: AuthorizedResourceContext): SupabaseClient {
  if (!ctx.organizationId || !ctx.userId) {
    throw new Error('authorized_admin_context_required')
  }
  assertAuthorizedBeforeServiceRole(ctx)
  return getSupabaseAdmin()
}

export function assertAuthorizedBeforeServiceRole(
  ctx: AuthorizedResourceContext | null | undefined,
): asserts ctx is AuthorizedResourceContext {
  if (!ctx?.authorizedAt || !ctx.organizationId) {
    throw new Error('service_role_requires_authorized_resource_context')
  }
}
