import { useCallback, useEffect, useState } from 'react'

import { probeFieldConnectivity } from '@/modules/field-operations/field-mobile/engine/field-connectivity'
import { computeFieldOperationalSummary } from '@/modules/field-operations/field-mobile/engine/field-progress'
import { estimateLocalFieldStorageBytes } from '@/modules/field-operations/field-mobile/engine/field-mobile-storage'
import { buildSyntheticFieldPackageRecord } from '@/modules/field-operations/field-mobile/fixtures/field-mobile-fixtures'
import type { FieldLocale, FieldOperationalSummary } from '@/modules/field-operations/field-mobile/field-mobile.types'
import { parsePackageTasks } from '@/modules/field-operations/field-forms/engine/package-compatibility'
import { FieldFormRepository } from '@/modules/field-operations/field-forms/field-form.repository'
import { OfflineEvidenceRepository } from '@/modules/field-operations/offline-evidence/offline-evidence.repository'
import { OfflinePackageRepository } from '@/modules/field-operations/offline-packages/offline-package.repository'
import { FieldSyncRepository } from '@/modules/field-operations/field-sync/field-sync.repository'

const packageRepo = OfflinePackageRepository.createDefault()
const formRepo = FieldFormRepository.createDefault()
const evidenceRepo = OfflineEvidenceRepository.createDefault()
const syncRepo = FieldSyncRepository.createDefault()

export function useFieldCampo(locale: FieldLocale = 'es') {
  const [summary, setSummary] = useState<FieldOperationalSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const packages = await packageRepo.list()
    const connectivity = (await probeFieldConnectivity()).state
    const storage = await estimateLocalFieldStorageBytes()

    const allProgress = []
    for (const pkg of packages) {
      const tasks = parsePackageTasks(pkg).map((t) => ({
        id: String(t.id),
        task_type: String(t.task_type),
        schema_id: t.form_schema_id ? String(t.form_schema_id) : null,
      }))
      allProgress.push(...(await formRepo.computeTaskProgress(pkg.package_id, tasks)))
    }

    const pendingBundles = await evidenceRepo.listBundles('pending_sync')
    const sessions = await syncRepo.listSessions()
    const conflicts = (
      await Promise.all(sessions.map((s) => syncRepo.listConflictsForSession(s.session_id)))
    ).flat()

    setSummary(
      computeFieldOperationalSummary({
        packages,
        taskProgress: allProgress,
        pendingSyncBundles: pendingBundles,
        syncSessions: sessions,
        conflicts,
        localStorageBytes: storage,
        connectivity,
        now_iso: new Date().toISOString(),
      }),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
    const onVis = () => void refresh()
    window.addEventListener('online', onVis)
    window.addEventListener('offline', onVis)
    return () => {
      window.removeEventListener('online', onVis)
      window.removeEventListener('offline', onVis)
    }
  }, [refresh])

  const installSyntheticDemo = useCallback(async () => {
    const record = buildSyntheticFieldPackageRecord()
    await packageRepo.saveDownload({
      mission_id: record.mission_id,
      mission_title: record.mission_title,
      manifest: record.manifest,
      payloads: record.payloads,
    })
    await refresh()
  }, [refresh])

  return { summary, loading, refresh, installSyntheticDemo, locale }
}

export function useFieldConflicts() {
  const [conflicts, setConflicts] = useState<
    Awaited<ReturnType<FieldSyncRepository['listConflictsForSession']>>
  >([])

  const refresh = useCallback(async () => {
    const sessions = await syncRepo.listSessions()
    const all = (
      await Promise.all(sessions.map((s) => syncRepo.listConflictsForSession(s.session_id)))
    ).flat()
    setConflicts(all.filter((c) => !c.resolved))
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { conflicts, refresh }
}
