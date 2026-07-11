import { useCallback, useEffect, useMemo, useState } from 'react'

import { FIRE_OFFLINE_EVIDENCE_MODEL_VERSION } from '@/modules/field-operations/offline-evidence/config/fire-offline-evidence.config'
import {
  addTimestampedNote,
  buildAndFinalizeTaskBundle,
  buildGeoLocation,
  captureContextFromPackage,
  capturePhotoEvidence,
  captureVideoEvidence,
  createStructuredEvidenceFromForm,
  deleteLocalEvidence,
  estimateStorageWarning,
  verifyAllAssets,
} from '@/modules/field-operations/offline-evidence/engine/offline-evidence-capture'
import { computeRequirementCoverage, parseRequirementsFromPackage } from '@/modules/field-operations/offline-evidence/engine/offline-evidence-matching'
import { OfflineEvidenceRepository } from '@/modules/field-operations/offline-evidence/offline-evidence.repository'
import type {
  LocalEvidenceBundle,
  LocalEvidenceRecord,
  RequirementCoverageSummary,
} from '@/modules/field-operations/offline-evidence/offline-evidence.types'
import type { FieldFormOutputPayload } from '@/modules/field-operations/field-forms/field-form.types'
import type { LocalOfflinePackageRecord } from '@/modules/field-operations/offline-packages/offline-package.repository'

const evidenceRepo = OfflineEvidenceRepository.createDefault()

function tabId(): string {
  return `tab-${Math.random().toString(36).slice(2, 10)}`
}

export function useOfflineEvidenceTask(
  pkg: LocalOfflinePackageRecord | null,
  taskId: string | null,
) {
  const [records, setRecords] = useState<LocalEvidenceRecord[]>([])
  const [coverage, setCoverage] = useState<RequirementCoverageSummary[]>([])
  const [bundle, setBundle] = useState<LocalEvidenceBundle | null>(null)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, _setError] = useState<string | null>(null)

  const currentTab = useMemo(() => tabId(), [])

  const refresh = useCallback(async () => {
    if (!pkg || !taskId) return
    setLoading(true)
    const reqs = parseRequirementsFromPackage(pkg.payloads)
    const taskRecords = await evidenceRepo.listRecordsForTask(pkg.package_id, taskId)
    const links = await evidenceRepo.listLinksForPackage(pkg.package_id)
    setRecords(taskRecords)
    setCoverage(computeRequirementCoverage(reqs, taskRecords, links))
    const bundles = (await evidenceRepo.listBundles()).filter(
      (b) => b.package_id === pkg.package_id && b.task_id === taskId && b.status !== 'superseded',
    )
    setBundle(bundles.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0] ?? null)
    setStorageWarning(await estimateStorageWarning(evidenceRepo))
    setLoading(false)
  }, [pkg, taskId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const ctx = useMemo(() => {
    if (!pkg || !taskId) return null
    return captureContextFromPackage(pkg, taskId, currentTab, new Date().toISOString())
  }, [pkg, taskId, currentTab])

  const capturePhoto = useCallback(
    async (file: File, location?: { lat: number; lng: number; accuracy_m?: number } | null) => {
      if (!pkg || !ctx) return { ok: false as const, reason: 'missing_context' }
      const bytes = new Uint8Array(await file.arrayBuffer())
      const geo = location
        ? buildGeoLocation({
            lat: location.lat,
            lng: location.lng,
            accuracy_m: location.accuracy_m ?? null,
            permission: 'granted',
            now_iso: ctx.now_iso,
          })
        : buildGeoLocation({ permission: 'denied', now_iso: ctx.now_iso })
      const result = await capturePhotoEvidence({
        repo: evidenceRepo,
        ctx,
        pkg_payloads: pkg.payloads,
        bytes,
        mime_type: file.type || 'image/jpeg',
        filename: file.name,
        location: geo,
      })
      await refresh()
      return result
    },
    [pkg, ctx, refresh],
  )

  const captureVideo = useCallback(
    async (file: File, durationSeconds: number) => {
      if (!pkg || !ctx) return { ok: false as const, reason: 'missing_context' }
      const bytes = new Uint8Array(await file.arrayBuffer())
      const result = await captureVideoEvidence({
        repo: evidenceRepo,
        ctx,
        pkg_payloads: pkg.payloads,
        bytes,
        mime_type: file.type || 'video/mp4',
        filename: file.name,
        duration_seconds: durationSeconds,
      })
      await refresh()
      return result
    },
    [pkg, ctx, refresh],
  )

  const addNote = useCallback(
    async (note: string) => {
      if (!pkg || !ctx) return { ok: false as const, reason: 'missing_context' }
      const result = await addTimestampedNote({
        repo: evidenceRepo,
        ctx,
        pkg_payloads: pkg.payloads,
        note,
      })
      await refresh()
      return result
    },
    [pkg, ctx, refresh],
  )

  const ingestFormOutput = useCallback(
    async (output: FieldFormOutputPayload) => {
      if (!pkg || !ctx) return { created: false, record: null, reason: 'missing_context' }
      const result = await createStructuredEvidenceFromForm({
        repo: evidenceRepo,
        ctx,
        output,
        pkg_payloads: pkg.payloads,
      })
      await refresh()
      return result
    },
    [pkg, ctx, refresh],
  )

  const prepareBundle = useCallback(
    async (allowLimitations = false) => {
      if (!pkg || !taskId) return null
      await verifyAllAssets(evidenceRepo, pkg.package_id)
      const result = await buildAndFinalizeTaskBundle({
        repo: evidenceRepo,
        pkg,
        task_id: taskId,
        allow_limitations: allowLimitations,
        tab_id: currentTab,
      })
      await refresh()
      return result
    },
    [pkg, taskId, currentTab, refresh],
  )

  const removeEvidence = useCallback(
    async (evidenceId: string) => {
      const result = await deleteLocalEvidence({ repo: evidenceRepo, evidence_id: evidenceId, confirm: true })
      await refresh()
      return result
    },
    [refresh],
  )

  return {
    modelVersion: FIRE_OFFLINE_EVIDENCE_MODEL_VERSION,
    loading,
    error,
    records,
    coverage,
    bundle,
    storageWarning,
    refresh,
    capturePhoto,
    captureVideo,
    addNote,
    ingestFormOutput,
    prepareBundle,
    removeEvidence,
  }
}

export function usePendingEvidenceBundles() {
  const [bundles, setBundles] = useState<LocalEvidenceBundle[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const pending = await evidenceRepo.listBundles('pending_sync')
    const blocked = await evidenceRepo.listBundles('sync_blocked')
    setBundles([...pending, ...blocked].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)))
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const totalBytes = bundles.reduce((s, b) => s + b.size_bytes, 0)

  return { bundles, loading, totalBytes, refresh }
}
