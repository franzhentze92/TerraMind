import { useCallback, useState } from 'react'

import { FIELD_REAL_SYNC_ENABLED } from '@/modules/field-operations/field-mobile/config/fire-field-mobile.config'
import { simulateBundleSync } from '@/modules/field-operations/field-mobile/engine/field-sync-simulator'
import type { SimulatedSyncResult } from '@/modules/field-operations/field-mobile/field-mobile.types'
import { createHttpSyncTransport } from '@/modules/field-operations/field-sync/api/field-sync-api'
import { createMockSyncTransport } from '@/modules/field-operations/field-sync/api/field-sync-mock-transport'
import { useRealSyncPilot } from '@/modules/field-operations/field-sync/hooks/useRealSyncPilot'
import {
  cancelSyncSession,
  pauseSyncSession,
  syncBundle,
} from '@/modules/field-operations/field-sync/engine/field-sync.orchestrator'
import { FieldSyncRepository } from '@/modules/field-operations/field-sync/field-sync.repository'
import type { LocalEvidenceBundle } from '@/modules/field-operations/offline-evidence/offline-evidence.types'
import { OfflineEvidenceRepository } from '@/modules/field-operations/offline-evidence/offline-evidence.repository'
import type { LocalOfflinePackageRecord } from '@/modules/field-operations/offline-packages/offline-package.repository'

const evidenceRepo = OfflineEvidenceRepository.createDefault()
const syncRepo = FieldSyncRepository.createDefault()

export function useFieldMobileSync(missionId?: string | null) {
  const [lastResult, setLastResult] = useState<SimulatedSyncResult | null>(null)
  const [running, setRunning] = useState(false)
  const pilot = useRealSyncPilot(missionId ?? undefined)

  const syncBundleSimulated = useCallback(
    async (
      bundle: LocalEvidenceBundle,
      pkg: LocalOfflinePackageRecord,
      options?: { interruptAfterBytes?: number; conflictScenario?: Parameters<typeof simulateBundleSync>[0]['conflictScenario'] },
    ) => {
      setRunning(true)
      try {
        const result = await simulateBundleSync({
          bundle,
          pkg,
          evidenceRepo,
          syncRepo,
          interruptAfterBytes: options?.interruptAfterBytes,
          conflictScenario: options?.conflictScenario,
        })
        setLastResult(result)
        return result
      } finally {
        setRunning(false)
      }
    },
    [],
  )

  const syncBundleSafe = useCallback(
    async (
      bundle: LocalEvidenceBundle,
      pkg: LocalOfflinePackageRecord,
      options?: {
        interruptAfterBytes?: number
        conflictScenario?: Parameters<typeof simulateBundleSync>[0]['conflictScenario']
      },
    ) => {
      const realAllowed = pilot.isRealSyncAllowed(bundle.mission_id)
      if (realAllowed) {
        setRunning(true)
        try {
          const result = await syncBundle({
            bundle,
            pkg,
            evidenceRepo,
            syncRepo,
            transport: createHttpSyncTransport(),
            tab_id: `campo-${Date.now()}`,
            permissions: ['evidence.submit', 'field_sync.execute'],
          })
          const simulated: SimulatedSyncResult = {
            ok: result.ok,
            steps: result.ok
              ? [{ phase: 'real_sync', message_key: 'complete', progress_pct: 100, at: new Date().toISOString() }]
              : [{ phase: 'real_sync', message_key: result.reason ?? 'failed', progress_pct: 0, at: new Date().toISOString() }],
            duplicate_submissions: 0,
            reason: result.reason,
          }
          setLastResult(simulated)
          return simulated
        } finally {
          setRunning(false)
        }
      }
      return syncBundleSimulated(bundle, pkg, options)
    },
    [pilot, syncBundleSimulated],
  )

  const pause = useCallback(async (sessionId: string) => pauseSyncSession(syncRepo, sessionId), [])
  const cancel = useCallback(async (sessionId: string) => cancelSyncSession(syncRepo, sessionId), [])

  return {
    realSyncEnabled: FIELD_REAL_SYNC_ENABLED || pilot.pilotActiveForMission,
    pilotActive: pilot.pilotActive,
    pilotActiveForMission: pilot.pilotActiveForMission,
    running,
    lastResult,
    syncBundleSimulated,
    syncBundleSafe,
    pause,
    cancel,
    listSessions: () => syncRepo.listSessions(),
  }
}

export async function runMockSyncDirect(
  bundle: LocalEvidenceBundle,
  pkg: LocalOfflinePackageRecord,
  repos?: { evidence?: OfflineEvidenceRepository; sync?: FieldSyncRepository },
) {
  if (FIELD_REAL_SYNC_ENABLED) throw new Error('real_sync_blocked')
  return syncBundle({
    bundle,
    pkg,
    evidenceRepo: repos?.evidence ?? evidenceRepo,
    syncRepo: repos?.sync ?? syncRepo,
    transport: createMockSyncTransport(),
    tab_id: 'mock-direct',
  })
}
