import type { RequestAuthContext } from '@/core/auth/permissions'
import { AuthorizationError } from '@/core/auth/permissions'
import {
  evaluateRealSyncPilotAccess,
  parseRealSyncPilotPolicyFromEnv,
  type RealSyncPilotPolicy,
} from '@/core/field-sync/real-sync-pilot-policy.js'
import { recordAuthAuditEvent } from '../services/auth-audit.service.js'

let cachedPolicy: RealSyncPilotPolicy | null = null

export function loadRealSyncPilotPolicy(): RealSyncPilotPolicy {
  if (cachedPolicy) return cachedPolicy
  cachedPolicy = parseRealSyncPilotPolicyFromEnv(process.env)
  return cachedPolicy
}

export function resetRealSyncPilotPolicyCache(): void {
  cachedPolicy = null
}

export async function assertRealSyncPilotAllowed(
  auth: RequestAuthContext,
  missionId: string,
  audit?: { req?: import('node:http').IncomingMessage; bundleId?: string },
): Promise<void> {
  if (process.env.AUTH_TEST_MODE === '1') return

  const policy = loadRealSyncPilotPolicy()
  const decision = evaluateRealSyncPilotAccess(policy, {
    authUserId: auth.authUserId,
    userProfileId: auth.userId,
    organizationId: auth.activeOrganizationId,
    missionId,
    permissions: auth.permissions,
  })

  if (decision.allowed) return

  await recordAuthAuditEvent({
    event_type: 'field_sync_pilot_denied',
    outcome: 'denied',
    req: audit?.req,
    auth,
    organization_id: auth.activeOrganizationId,
    resource_type: 'mission',
    resource_id: missionId,
    metadata: {
      reason: decision.reason ?? 'unknown',
      bundle_id: audit?.bundleId ?? null,
    },
  })

  throw new AuthorizationError(`Real sync pilot denied: ${decision.reason ?? 'unknown'}`, 403)
}
