import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAuthQueryReady } from '@/core/auth/use-auth-query-ready'
import { createHttpSyncTransport } from '@/modules/field-operations/field-sync/api/field-sync-api'
import { createMockSyncTransport } from '@/modules/field-operations/field-sync/api/field-sync-mock-transport'
import { FIELD_REAL_SYNC_ENABLED } from '@/modules/field-operations/field-mobile/config/fire-field-mobile.config'
import {
  cancelSyncSession,
  computeSyncProgress,
  pauseSyncSession,
  syncBundle,
} from '@/modules/field-operations/field-sync/engine/field-sync.orchestrator'
import { FieldSyncRepository } from '@/modules/field-operations/field-sync/field-sync.repository'
import type { SyncProgressSummary, SyncSession } from '@/modules/field-operations/field-sync/field-sync.types'
import { OfflineEvidenceRepository } from '@/modules/field-operations/offline-evidence/offline-evidence.repository'
import type { LocalEvidenceBundle } from '@/modules/field-operations/offline-evidence/offline-evidence.types'
import { OfflinePackageRepository } from '@/modules/field-operations/offline-packages/offline-package.repository'

const evidenceRepo = OfflineEvidenceRepository.createDefault()
const syncRepo = FieldSyncRepository.createDefault()
const packageRepo = OfflinePackageRepository.createDefault()
const transport = FIELD_REAL_SYNC_ENABLED ? createHttpSyncTransport() : createMockSyncTransport()

export function useFieldSync() {
  const authReady = useAuthQueryReady()
  const [sessions, setSessions] = useState<SyncSession[]>([])
  const [loading, setLoading] = useState(true)
  const tabIdRef = useRef(`tab-${Math.random().toString(36).slice(2, 10)}`)

  const refresh = useCallback(async () => {
    setLoading(true)
    setSessions(await syncRepo.listSessions())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authReady) {
      setSessions([])
      setLoading(false)
      return
    }
    void refresh()
  }, [authReady, refresh])

  const syncNow = useCallback(
    async (bundle: LocalEvidenceBundle) => {
      const pkg = await packageRepo.read(bundle.package_id)
      if (!pkg) throw new Error('package_not_found')
      const result = await syncBundle({
        bundle,
        pkg,
        evidenceRepo,
        syncRepo,
        transport,
        tab_id: tabIdRef.current,
      })
      await refresh()
      return result
    },
    [refresh],
  )

  const getProgress = useCallback(async (sessionId: string): Promise<SyncProgressSummary | null> => {
    const session = await syncRepo.getSession(sessionId)
    if (!session) return null
    const operations = await syncRepo.listOperationsForSession(sessionId)
    const upload_sessions = await syncRepo.listUploadSessionsForSession(sessionId)
    const conflicts = await syncRepo.listConflictsForSession(sessionId)
    const mappings = await syncRepo.listMappingsForBundle(session.bundle_id)
    return {
      session,
      operations,
      upload_sessions,
      conflicts,
      mappings,
      progress_pct: computeSyncProgress(session, operations),
    }
  }, [])

  const pause = useCallback(
    async (sessionId: string) => {
      await pauseSyncSession(syncRepo, sessionId)
      await refresh()
    },
    [refresh],
  )

  const cancel = useCallback(
    async (sessionId: string) => {
      await cancelSyncSession(syncRepo, sessionId)
      await refresh()
    },
    [refresh],
  )

  return useMemo(
    () => ({ sessions, loading, refresh, syncNow, getProgress, pause, cancel }),
    [sessions, loading, refresh, syncNow, getProgress, pause, cancel],
  )
}

export function usePendingSyncBundles() {
  const authReady = useAuthQueryReady()
  const { refresh: refreshFieldSync, ...fieldSync } = useFieldSync()
  const [bundles, setBundles] = useState<LocalEvidenceBundle[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!authReady) {
      setBundles([])
      setLoading(false)
      return
    }
    setLoading(true)
    const pending = await evidenceRepo.listBundles('pending_sync')
    const blocked = await evidenceRepo.listBundles('sync_blocked')
    setBundles([...pending, ...blocked])
    setLoading(false)
    await refreshFieldSync()
  }, [authReady, refreshFieldSync])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { bundles, loading, refresh, syncNow: fieldSync.syncNow, getProgress: fieldSync.getProgress, pause: fieldSync.pause, cancel: fieldSync.cancel, sessions: fieldSync.sessions }
}
