import { useCallback, useEffect, useState } from 'react'

import { createHttpSyncTransport } from '@/modules/field-operations/field-sync/api/field-sync-api'
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
const transport = createHttpSyncTransport()

function tabId() {
  return `tab-${Math.random().toString(36).slice(2, 10)}`
}

export function useFieldSync() {
  const [sessions, setSessions] = useState<SyncSession[]>([])
  const [loading, setLoading] = useState(true)
  const currentTab = tabId()

  const refresh = useCallback(async () => {
    setLoading(true)
    setSessions(await syncRepo.listSessions())
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const syncNow = useCallback(
    async (bundle: LocalEvidenceBundle) => {
      const pkg = await packageRepo.read(bundle.package_id)
      const result = await syncBundle({
        bundle,
        pkg,
        evidenceRepo,
        syncRepo,
        transport,
        tab_id: currentTab,
      })
      await refresh()
      return result
    },
    [currentTab, refresh],
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

  return { sessions, loading, refresh, syncNow, getProgress, pause, cancel }
}

export function usePendingSyncBundles() {
  const [bundles, setBundles] = useState<LocalEvidenceBundle[]>([])
  const [loading, setLoading] = useState(true)
  const fieldSync = useFieldSync()

  const refresh = useCallback(async () => {
    setLoading(true)
    const pending = await evidenceRepo.listBundles('pending_sync')
    const blocked = await evidenceRepo.listBundles('sync_blocked')
    setBundles([...pending, ...blocked])
    setLoading(false)
    await fieldSync.refresh()
  }, [fieldSync])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { bundles, loading, refresh, ...fieldSync }
}
