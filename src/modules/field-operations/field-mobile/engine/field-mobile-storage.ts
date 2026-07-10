import { OfflineEvidenceRepository } from '@/modules/field-operations/offline-evidence/offline-evidence.repository'
import { OfflinePackageRepository } from '@/modules/field-operations/offline-packages/offline-package.repository'
import { FieldSyncRepository } from '@/modules/field-operations/field-sync/field-sync.repository'
import { FieldFormRepository } from '@/modules/field-operations/field-forms/field-form.repository'

export async function estimateLocalFieldStorageBytes(): Promise<number> {
  const evidence = OfflineEvidenceRepository.createDefault()
  const blobs = await evidence.estimateStorageBytes()
  const packages = await OfflinePackageRepository.createDefault().list()
  const pkgBytes = packages.reduce((s, p) => s + p.size_bytes, 0)
  return blobs + pkgBytes
}

export async function listPendingSyncBundleCount(): Promise<number> {
  const repo = OfflineEvidenceRepository.createDefault()
  const pending = await repo.listBundles('pending_sync')
  return pending.length
}

export function logoutWarningRequired(pendingBundles: number, pendingSyncSessions: number): boolean {
  return pendingBundles > 0 || pendingSyncSessions > 0
}

export async function reloadFieldStateSnapshot() {
  const packageRepo = OfflinePackageRepository.createDefault()
  const evidenceRepo = OfflineEvidenceRepository.createDefault()
  const syncRepo = FieldSyncRepository.createDefault()
  const formRepo = FieldFormRepository.createDefault()

  const packages = await packageRepo.list()
  const bundles = await evidenceRepo.listBundles()
  const sessions = await syncRepo.listSessions()
  const storage = await estimateLocalFieldStorageBytes()

  return { packages, bundles, sessions, storage, formRepo }
}
