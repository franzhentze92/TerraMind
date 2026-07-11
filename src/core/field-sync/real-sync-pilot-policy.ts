/**
 * 8B.7G — Controlled Real Field Sync Pilot policy.
 * Global FIELD_REAL_SYNC_ENABLED stays false; pilot uses explicit allowlists.
 */
export interface RealSyncPilotPolicy {
  enabled: boolean
  allowedOrganizationIds: readonly string[]
  allowedUserIds: readonly string[]
  allowedMissionIds: readonly string[]
}

export interface RealSyncPilotContext {
  authUserId: string
  userProfileId: string
  organizationId: string
  missionId: string
  permissions: readonly string[]
}

export type RealSyncPilotDenialReason =
  | 'pilot_disabled'
  | 'global_sync_not_enabled'
  | 'organization_not_allowlisted'
  | 'user_not_allowlisted'
  | 'mission_not_allowlisted'
  | 'missing_field_sync_execute'
  | 'missing_context'

export interface RealSyncPilotDecision {
  allowed: boolean
  reason?: RealSyncPilotDenialReason
}

export const EMPTY_REAL_SYNC_PILOT_POLICY: RealSyncPilotPolicy = {
  enabled: false,
  allowedOrganizationIds: [],
  allowedUserIds: [],
  allowedMissionIds: [],
}

export function parseCsvIds(value: string | undefined | null): string[] {
  if (!value?.trim()) return []
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

export function parseRealSyncPilotPolicyFromEnv(env: {
  FIELD_REAL_SYNC_PILOT_ENABLED?: string
  FIELD_SYNC_PILOT_ORG_IDS?: string
  FIELD_SYNC_PILOT_USER_IDS?: string
  FIELD_SYNC_PILOT_MISSION_IDS?: string
}): RealSyncPilotPolicy {
  return {
    enabled: env.FIELD_REAL_SYNC_PILOT_ENABLED === 'true' || env.FIELD_REAL_SYNC_PILOT_ENABLED === '1',
    allowedOrganizationIds: parseCsvIds(env.FIELD_SYNC_PILOT_ORG_IDS),
    allowedUserIds: parseCsvIds(env.FIELD_SYNC_PILOT_USER_IDS),
    allowedMissionIds: parseCsvIds(env.FIELD_SYNC_PILOT_MISSION_IDS),
  }
}

export function sanitizePilotPolicyForClient(
  policy: RealSyncPilotPolicy,
): Pick<RealSyncPilotPolicy, 'enabled' | 'allowedMissionIds'> & { pilotActive: boolean } {
  return {
    enabled: policy.enabled,
    pilotActive: policy.enabled,
    allowedMissionIds: [...policy.allowedMissionIds],
  }
}

export function evaluateRealSyncPilotAccess(
  policy: RealSyncPilotPolicy,
  ctx: RealSyncPilotContext,
  options?: { globalRealSyncEnabled?: boolean },
): RealSyncPilotDecision {
  if (options?.globalRealSyncEnabled) {
    return { allowed: true }
  }

  if (!policy.enabled) {
    return { allowed: false, reason: 'pilot_disabled' }
  }

  if (!ctx.authUserId || !ctx.organizationId || !ctx.missionId) {
    return { allowed: false, reason: 'missing_context' }
  }

  if (
    policy.allowedOrganizationIds.length > 0 &&
    !policy.allowedOrganizationIds.includes(ctx.organizationId)
  ) {
    return { allowed: false, reason: 'organization_not_allowlisted' }
  }

  const userAllowed =
    policy.allowedUserIds.includes(ctx.authUserId) ||
    policy.allowedUserIds.includes(ctx.userProfileId)
  if (policy.allowedUserIds.length > 0 && !userAllowed) {
    return { allowed: false, reason: 'user_not_allowlisted' }
  }

  if (
    policy.allowedMissionIds.length > 0 &&
    !policy.allowedMissionIds.includes(ctx.missionId)
  ) {
    return { allowed: false, reason: 'mission_not_allowlisted' }
  }

  if (!ctx.permissions.includes('field_sync.execute')) {
    return { allowed: false, reason: 'missing_field_sync_execute' }
  }

  return { allowed: true }
}

export function maskProjectRef(ref: string): string {
  if (ref.length <= 8) return '****'
  return `${ref.slice(0, 4)}…${ref.slice(-4)}`
}
