import { useCallback, useEffect, useState } from 'react'

import {
  evaluateRealSyncPilotAccess,
  type RealSyncPilotPolicy,
} from '@/core/field-sync/real-sync-pilot-policy'
import { FIELD_REAL_SYNC_ENABLED } from '@/modules/field-operations/field-mobile/config/fire-field-mobile.config'
import { useAuth } from '@/core/auth/AuthProvider'

const EMPTY: RealSyncPilotPolicy = {
  enabled: false,
  allowedOrganizationIds: [],
  allowedUserIds: [],
  allowedMissionIds: [],
}

export function useRealSyncPilot(missionId?: string | null) {
  const { session } = useAuth()
  const [policy, setPolicy] = useState<RealSyncPilotPolicy>(EMPTY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const headers: Record<string, string> = { Accept: 'application/json' }
        if (missionId) headers['x-terramind-mission-id'] = missionId
        const res = await fetch('/api/operations/field-sync/pilot-policy', {
          credentials: 'include',
          headers,
        })
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
  }, [missionId])

  const isRealSyncAllowed = useCallback(
    (targetMissionId: string) => {
      if (FIELD_REAL_SYNC_ENABLED) return true
      const ctx = session?.context
      if (!ctx) return false
      return evaluateRealSyncPilotAccess(policy, {
        authUserId: ctx.authUserId,
        userProfileId: ctx.userId,
        organizationId: ctx.activeOrganizationId,
        missionId: targetMissionId,
        permissions: ctx.permissions,
      }).allowed
    },
    [policy, session?.context],
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
