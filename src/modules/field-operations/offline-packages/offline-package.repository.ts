import type { LocalOfflinePackageStatus, OfflinePackageManifest } from '@/modules/field-operations/offline-packages/offline-package.types'
import { verifyManifestIntegrity } from '@/modules/field-operations/offline-packages/offline-package-canonical'

export interface LocalOfflinePackageRecord {
  package_id: string
  mission_id: string
  mission_title: string
  package_version: number
  local_status: LocalOfflinePackageStatus
  manifest: OfflinePackageManifest
  payloads: Array<{ path: string; content: string }>
  downloaded_at: string | null
  superseded_by: string | null
  size_bytes: number
  integrity_errors: string[]
  updated_at: string
}

export interface OfflinePackageStorageAdapter {
  save(record: LocalOfflinePackageRecord): Promise<void>
  read(packageId: string): Promise<LocalOfflinePackageRecord | null>
  list(): Promise<LocalOfflinePackageRecord[]>
  delete(packageId: string): Promise<void>
}

export class MemoryOfflinePackageStorage implements OfflinePackageStorageAdapter {
  private records = new Map<string, LocalOfflinePackageRecord>()

  async save(record: LocalOfflinePackageRecord): Promise<void> {
    this.records.set(record.package_id, record)
  }

  async read(packageId: string): Promise<LocalOfflinePackageRecord | null> {
    return this.records.get(packageId) ?? null
  }

  async list(): Promise<LocalOfflinePackageRecord[]> {
    return [...this.records.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }

  async delete(packageId: string): Promise<void> {
    this.records.delete(packageId)
  }
}

const DB_NAME = 'terramind-offline-packages'
const STORE_NAME = 'packages'
const DB_VERSION = 1

export class IndexedDbOfflinePackageStorage implements OfflinePackageStorageAdapter {
  private dbPromise: Promise<IDBDatabase> | null = null

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise
    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB no disponible'))
        return
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'package_id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
    })
    return this.dbPromise
  }

  async save(record: LocalOfflinePackageRecord): Promise<void> {
    const db = await this.openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(record)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB save failed'))
    })
  }

  async read(packageId: string): Promise<LocalOfflinePackageRecord | null> {
    const db = await this.openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).get(packageId)
      request.onsuccess = () => resolve((request.result as LocalOfflinePackageRecord | undefined) ?? null)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'))
    })
  }

  async list(): Promise<LocalOfflinePackageRecord[]> {
    const db = await this.openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).getAll()
      request.onsuccess = () => {
        const rows = (request.result as LocalOfflinePackageRecord[]) ?? []
        resolve(rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at)))
      }
      request.onerror = () => reject(request.error ?? new Error('IndexedDB list failed'))
    })
  }

  async delete(packageId: string): Promise<void> {
    const db = await this.openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(packageId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'))
    })
  }
}

export class OfflinePackageRepository {
  constructor(private storage: OfflinePackageStorageAdapter) {}

  static createDefault(): OfflinePackageRepository {
    if (typeof indexedDB !== 'undefined') {
      return new OfflinePackageRepository(new IndexedDbOfflinePackageStorage())
    }
    return new OfflinePackageRepository(new MemoryOfflinePackageStorage())
  }

  static createInMemory(): OfflinePackageRepository {
    return new OfflinePackageRepository(new MemoryOfflinePackageStorage())
  }

  async saveDownload(input: {
    mission_id: string
    mission_title: string
    manifest: OfflinePackageManifest
    payloads: Array<{ path: string; content: string }>
    signingKey?: string | null
  }): Promise<LocalOfflinePackageRecord> {
    const integrity = verifyManifestIntegrity(input.manifest, input.payloads, input.signingKey)
    const size_bytes = input.payloads.reduce(
      (sum, p) => sum + new TextEncoder().encode(p.content).length,
      0,
    )
    const now = new Date().toISOString()
    const record: LocalOfflinePackageRecord = {
      package_id: input.manifest.package_id,
      mission_id: input.mission_id,
      mission_title: input.mission_title,
      package_version: input.manifest.package_version,
      local_status: integrity.valid ? 'available' : 'integrity_failed',
      manifest: input.manifest,
      payloads: input.payloads,
      downloaded_at: now,
      superseded_by: null,
      size_bytes,
      integrity_errors: integrity.errors,
      updated_at: now,
    }
    await this.storage.save(record)
    return record
  }

  async read(packageId: string): Promise<LocalOfflinePackageRecord | null> {
    return this.storage.read(packageId)
  }

  async list(): Promise<LocalOfflinePackageRecord[]> {
    return this.storage.list()
  }

  async validate(packageId: string, signingKey?: string | null): Promise<LocalOfflinePackageRecord | null> {
    const record = await this.storage.read(packageId)
    if (!record) return null
    const integrity = verifyManifestIntegrity(record.manifest, record.payloads, signingKey)
    const updated: LocalOfflinePackageRecord = {
      ...record,
      local_status: integrity.valid ? record.local_status : 'integrity_failed',
      integrity_errors: integrity.errors,
      updated_at: new Date().toISOString(),
    }
    await this.storage.save(updated)
    return updated
  }

  async markActive(packageId: string): Promise<void> {
    const record = await this.storage.read(packageId)
    if (!record || record.local_status === 'integrity_failed') return
    await this.storage.save({ ...record, local_status: 'available', updated_at: new Date().toISOString() })
  }

  async supersede(packageId: string, replacedBy: string): Promise<void> {
    const record = await this.storage.read(packageId)
    if (!record) return
    await this.storage.save({
      ...record,
      local_status: 'superseded',
      superseded_by: replacedBy,
      updated_at: new Date().toISOString(),
    })
  }

  async revoke(packageId: string): Promise<void> {
    const record = await this.storage.read(packageId)
    if (!record) return
    await this.storage.save({
      ...record,
      local_status: 'revoked',
      updated_at: new Date().toISOString(),
    })
  }

  async expire(packageId: string): Promise<void> {
    const record = await this.storage.read(packageId)
    if (!record) return
    await this.storage.save({
      ...record,
      local_status: 'expired',
      updated_at: new Date().toISOString(),
    })
  }

  async safeDelete(packageId: string): Promise<boolean> {
    const record = await this.storage.read(packageId)
    if (!record) return false
    if (record.local_status === 'available') return false
    await this.storage.delete(packageId)
    return true
  }
}

export function canOpenLocalPackage(record: LocalOfflinePackageRecord): boolean {
  return record.local_status !== 'integrity_failed'
}

export function canStartFieldExecution(record: LocalOfflinePackageRecord, nowIso: string): boolean {
  if (record.local_status === 'integrity_failed') return false
  if (record.local_status === 'revoked' || record.local_status === 'superseded') return false
  return Date.parse(record.manifest.valid_until) >= Date.parse(nowIso)
}
