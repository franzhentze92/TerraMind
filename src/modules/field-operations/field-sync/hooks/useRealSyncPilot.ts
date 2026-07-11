import { useCallback, useEffect, useState } from 'react'

import { authFetch } from '@/core/auth/auth-fetch'
import {
  evaluateRealSyncPilotAccess,
  type RealSyncPilotPolicy,
} from '@/core/field-sync/real-sync-pilot-policy'
import { useAuth } from '@/core/auth/AuthProvider'
import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import { FIELD_REAL_SYNC_ENABLED } from '@/modules/field-operations/field-mobile/config/fire-field-mobile.config'

const EMPTY: RealSyncPilotPolicy = {
  enabled: false,
  allowedOrganizationIds: [],
  allowedUserIds: [],
  allowedMissionIds: [],
}

export function useRealSyncPilot(missionId?: string | null) {
  const { authContext } = useAuth()
  const authReady = useAuthQueryReady()
  const [policy, setPolicy] = useState<RealSyncPilotPolicy>(EMPTY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authReady) {
      setPolicy(EMPTY)
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const headers: Record<string, string> = { Accept: 'application/json' }
        if (missionId) headers['x-terramind-mission-id'] = missionId
        const res = await authFetch('/api/operations/field-sync/pilot-policy', { headers })
        if (!res.ok) throw new Error('pilot_policy_unavailable')
        const body = (await res.json()) as {
          enabled: boolean
          allowedMissionIds: string[]
        }
        if (!cancelled) {
          setPolicy({
            enabled: Boolean(body.enabled),
            allowedOrganizationIds: [],
            allowedUserIds: [],
            allowedMissionIds: body.allowedMissionIds ?? [],
          })
        }
      } catch {
        if (!cancelled) setPolicy(EMPTY)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authReady, missionId])

  const isRealSyncAllowed = useCallback(
    (targetMissionId: string) => {
      if (FIELD_REAL_SYNC_ENABLED) return true
      if (!authContext) return false
      return evaluateRealSyncPilotAccess(policy, {
        authUserId: authContext.authUserId,
        userProfileId: authContext.userId,
        organizationId: authContext.activeOrganizationId,
        missionId: targetMissionId,
        permissions: authContext.permissions,
      }).allowed
    },
    [authContext, policy],
  )

  const pilotActiveForMission = missionId ? isRealSyncAllowed(missionId) : false

  return {
    loading,
    policy,
    pilotActive: policy.enabled,
    pilotActiveForMission,
    isRealSyncAllowed,
    useRealTransport: pilotActiveForMission,
    globalRealSyncEnabled: FIELD_REAL_SYNC_ENABLED,
  }
}
