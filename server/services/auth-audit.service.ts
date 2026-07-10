import type { IncomingMessage } from 'node:http'

import type { RequestAuthContext } from '@/core/auth/permissions'

const auditBuffer: Array<Record<string, unknown>> = []

export async function recordAuthAuditEvent(input: {
  event_type: string
  outcome: 'allowed' | 'denied' | 'error'
  req?: IncomingMessage
  auth?: RequestAuthContext
  organization_id?: string
  resource_type?: string
  resource_id?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  const entry = {
    event_type: input.event_type,
    outcome: input.outcome,
    auth_user_id: input.auth?.authUserId ?? null,
    user_id: input.auth?.userId ?? null,
    organization_id: input.organization_id ?? input.auth?.activeOrganizationId ?? null,
    resource_type: input.resource_type ?? null,
    resource_id: input.resource_id ?? null,
    metadata: sanitizeAuditMetadata(input.metadata ?? {}),
    ip_address: input.req?.socket.remoteAddress ?? null,
    created_at: new Date().toISOString(),
  }

  auditBuffer.push(entry)
  if (auditBuffer.length > 500) auditBuffer.shift()

  if (process.env.AUTH_AUDIT_PERSIST === '1') {
    try {
      const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
      await getSupabaseAdmin().from('auth_audit_events').insert(entry)
    } catch {
      // Tables may not exist until migration 029 is applied
    }
  }
}

function sanitizeAuditMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    const lower = key.toLowerCase()
    if (lower.includes('token') || lower.includes('secret') || lower.includes('password')) continue
    out[key] = value
  }
  return out
}

export function drainAuthAuditBuffer(): typeof auditBuffer {
  return [...auditBuffer]
}

export function clearAuthAuditBuffer(): void {
  auditBuffer.length = 0
}
