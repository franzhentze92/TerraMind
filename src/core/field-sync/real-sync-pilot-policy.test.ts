import { describe, expect, it } from 'vitest'

import {
  evaluateRealSyncPilotAccess,
  parseRealSyncPilotPolicyFromEnv,
} from '@/core/field-sync/real-sync-pilot-policy'

describe('real-sync-pilot-policy — 8B.7G', () => {
  const policy = parseRealSyncPilotPolicyFromEnv({
    FIELD_REAL_SYNC_PILOT_ENABLED: 'true',
    FIELD_SYNC_PILOT_ORG_IDS: 'org-1',
    FIELD_SYNC_PILOT_USER_IDS: 'user-auth-1',
    FIELD_SYNC_PILOT_MISSION_IDS: 'mission-1',
  })

  const ctx = {
    authUserId: 'user-auth-1',
    userProfileId: 'profile-1',
    organizationId: 'org-1',
    missionId: 'mission-1',
    permissions: ['field_sync.execute', 'evidence.submit'],
  }

  it('allows allowlisted pilot context', () => {
    expect(evaluateRealSyncPilotAccess(policy, ctx).allowed).toBe(true)
  })

  it('denies mission not allowlisted', () => {
    expect(
      evaluateRealSyncPilotAccess(policy, { ...ctx, missionId: 'other-mission' }).reason,
    ).toBe('mission_not_allowlisted')
  })

  it('denies user not allowlisted', () => {
    expect(
      evaluateRealSyncPilotAccess(policy, { ...ctx, authUserId: 'other-user' }).reason,
    ).toBe('user_not_allowlisted')
  })

  it('denies when pilot disabled', () => {
    const disabled = parseRealSyncPilotPolicyFromEnv({ FIELD_REAL_SYNC_PILOT_ENABLED: 'false' })
    expect(evaluateRealSyncPilotAccess(disabled, ctx).reason).toBe('pilot_disabled')
  })

  it('denies missing field_sync.execute permission', () => {
    expect(
      evaluateRealSyncPilotAccess(policy, { ...ctx, permissions: ['evidence.submit'] }).reason,
    ).toBe('missing_field_sync_execute')
  })
})
