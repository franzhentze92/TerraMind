import type {
  LocalEvidenceAsset,
  LocalEvidenceBundle,
  LocalEvidenceEvent,
  LocalEvidenceRecord,
  LocalEvidenceRequirementLink,
} from '@/modules/field-operations/offline-evidence/offline-evidence.types'
import { fieldLocalDbName } from '@/core/auth/field-local-scope'

export interface BlobStoreAdapter {
  put(ref: string, data: Uint8Array): Promise<void>
  get(ref: string): Promise<Uint8Array | null>
  delete(ref: string): Promise<void>
  has(ref: string): Promise<boolean>
  estimateBytes(): Promise<number>
}

export interface OfflineEvidenceStorageAdapter {
  saveRecord(record: LocalEvidenceRecord): Promise<void>
  getRecord(id: string): Promise<LocalEvidenceRecord | null>
  listRecordsForPackage(packageId: string): Promise<LocalEvidenceRecord[]>
  listRecordsForTask(packageId: string, taskId: string): Promise<LocalEvidenceRecord[]>
  saveAsset(asset: LocalEvidenceAsset): Promise<void>
  getAsset(id: string): Promise<LocalEvidenceAsset | null>
  listAssetsForEvidence(evidenceId: string): Promise<LocalEvidenceAsset[]>
  listAssetsForPackage(packageId: string): Promise<LocalEvidenceAsset[]>
  saveLink(link: LocalEvidenceRequirementLink): Promise<void>
  listLinksForPackage(packageId: string): Promise<LocalEvidenceRequirementLink[]>
  saveEvent(event: LocalEvidenceEvent): Promise<void>
  listEvents(limit?: number): Promise<LocalEvidenceEvent[]>
  saveBundle(bundle: LocalEvidenceBundle): Promise<void>
  getBundle(id: string): Promise<LocalEvidenceBundle | null>
  listBundles(status?: string): Promise<LocalEvidenceBundle[]>
  blobs: BlobStoreAdapter
}

export class MemoryBlobStore implements BlobStoreAdapter {
  private store = new Map<string, Uint8Array>()

  async put(ref: string, data: Uint8Array): Promise<void> {
    this.store.set(ref, data)
  }

  async get(ref: string): Promise<Uint8Array | null> {
    return this.store.get(ref) ?? null
  }

  async delete(ref: string): Promise<void> {
    this.store.delete(ref)
  }

  async has(ref: string): Promise<boolean> {
    return this.store.has(ref)
  }

  async estimateBytes(): Promise<number> {
    let total = 0
    for (const v of this.store.values()) total += v.byteLength
    return total
  }
}

export class MemoryOfflineEvidenceStorage implements OfflineEvidenceStorageAdapter {
  records = new Map<string, LocalEvidenceRecord>()
  assets = new Map<string, LocalEvidenceAsset>()
  links: LocalEvidenceRequirementLink[] = []
  events: LocalEvidenceEvent[] = []
  bundles = new Map<string, LocalEvidenceBundle>()
  blobs = new MemoryBlobStore()

  async saveRecord(record: LocalEvidenceRecord): Promise<void> {
    this.records.set(record.local_evidence_id, record)
  }

  async getRecord(id: string): Promise<LocalEvidenceRecord | null> {
    return this.records.get(id) ?? null
  }

  async listRecordsForPackage(packageId: string): Promise<LocalEvidenceRecord[]> {
    return [...this.records.values()].filter((r) => r.package_id === packageId)
  }

  async listRecordsForTask(packageId: string, taskId: string): Promise<LocalEvidenceRecord[]> {
    return [...this.records.values()].filter((r) => r.package_id === packageId && r.task_id === taskId)
  }

  async saveAsset(asset: LocalEvidenceAsset): Promise<void> {
    this.assets.set(asset.local_asset_id, asset)
  }

  async getAsset(id: string): Promise<LocalEvidenceAsset | null> {
    return this.assets.get(id) ?? null
  }

  async listAssetsForEvidence(evidenceId: string): Promise<LocalEvidenceAsset[]> {
    return [...this.assets.values()].filter((a) => a.local_evidence_id === evidenceId)
  }

  async listAssetsForPackage(packageId: string): Promise<LocalEvidenceAsset[]> {
    const recordIds = new Set(
      (await this.listRecordsForPackage(packageId)).map((r) => r.local_evidence_id),
    )
    return [...this.assets.values()].filter((a) => recordIds.has(a.local_evidence_id))
  }

  async saveLink(link: LocalEvidenceRequirementLink): Promise<void> {
    this.links = this.links.filter(
      (l) => !(l.local_evidence_id === link.local_evidence_id && l.requirement_id === link.requirement_id),
    )
    this.links.push(link)
  }

  async listLinksForPackage(packageId: string): Promise<LocalEvidenceRequirementLink[]> {
    const ids = new Set((await this.listRecordsForPackage(packageId)).map((r) => r.local_evidence_id))
    return this.links.filter((l) => ids.has(l.local_evidence_id))
  }

  async saveEvent(event: LocalEvidenceEvent): Promise<void> {
    this.events.unshift(event)
  }

  async listEvents(limit = 100): Promise<LocalEvidenceEvent[]> {
    return this.events.slice(0, limit)
  }

  async saveBundle(bundle: LocalEvidenceBundle): Promise<void> {
    this.bundles.set(bundle.bundle_id, bundle)
  }

  async getBundle(id: string): Promise<LocalEvidenceBundle | null> {
    return this.bundles.get(id) ?? null
  }

  async listBundles(status?: string): Promise<LocalEvidenceBundle[]> {
    const all = [...this.bundles.values()]
    return status ? all.filter((b) => b.status === status) : all
  }
}

const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(fieldLocalDbName('terramind-offline-evidence'), DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('records')) {
        const s = db.createObjectStore('records', { keyPath: 'local_evidence_id' })
        s.createIndex('package_id', 'package_id', { unique: false })
        s.createIndex('package_task', ['package_id', 'task_id'], { unique: false })
      }
      if (!db.objectStoreNames.contains('assets')) {
        const s = db.createObjectStore('assets', { keyPath: 'local_asset_id' })
        s.createIndex('local_evidence_id', 'local_evidence_id', { unique: false })
      }
      if (!db.objectStoreNames.contains('links')) db.createObjectStore('links', { keyPath: ['local_evidence_id', 'requirement_id'] })
      if (!db.objectStoreNames.contains('events')) db.createObjectStore('events', { keyPath: 'event_id' })
      if (!db.objectStoreNames.contains('bundles')) {
        const s = db.createObjectStore('bundles', { keyPath: 'bundle_id' })
        s.createIndex('status', 'status', { unique: false })
      }
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

class IndexedDbBlobStore implements BlobStoreAdapter {
  async put(ref: string, data: Uint8Array): Promise<void> {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('blobs', 'readwrite')
      tx.objectStore('blobs').put(data, ref)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async get(ref: string): Promise<Uint8Array | null> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('blobs', 'readonly')
      const req = tx.objectStore('blobs').get(ref)
      req.onsuccess = () => resolve((req.result as Uint8Array | undefined) ?? null)
      req.onerror = () => reject(req.error)
    })
  }

  async delete(ref: string): Promise<void> {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('blobs', 'readwrite')
      tx.objectStore('blobs').delete(ref)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async has(ref: string): Promise<boolean> {
    return (await this.get(ref)) !== null
  }

  async estimateBytes(): Promise<number> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('blobs', 'readonly')
      const req = tx.objectStore('blobs').getAll()
      req.onsuccess = () => {
        const rows = (req.result as Uint8Array[]) ?? []
        resolve(rows.reduce((s, b) => s + b.byteLength, 0))
      }
      req.onerror = () => reject(req.error)
    })
  }
}

export class IndexedDbOfflineEvidenceStorage implements OfflineEvidenceStorageAdapter {
  blobs = new IndexedDbBlobStore()

  private async putStore(store: string, value: unknown): Promise<void> {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).put(value)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async saveRecord(record: LocalEvidenceRecord): Promise<void> {
    await this.putStore('records', record)
  }

  async getRecord(id: string): Promise<LocalEvidenceRecord | null> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('records', 'readonly')
      const req = tx.objectStore('records').get(id)
      req.onsuccess = () => resolve((req.result as LocalEvidenceRecord | undefined) ?? null)
      req.onerror = () => reject(req.error)
    })
  }

  async listRecordsForPackage(packageId: string): Promise<LocalEvidenceRecord[]> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('records', 'readonly')
      const req = tx.objectStore('records').index('package_id').getAll(packageId)
      req.onsuccess = () => resolve((req.result as LocalEvidenceRecord[]) ?? [])
      req.onerror = () => reject(req.error)
    })
  }

  async listRecordsForTask(packageId: string, taskId: string): Promise<LocalEvidenceRecord[]> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('records', 'readonly')
      const req = tx.objectStore('records').index('package_task').getAll([packageId, taskId])
      req.onsuccess = () => resolve((req.result as LocalEvidenceRecord[]) ?? [])
      req.onerror = () => reject(req.error)
    })
  }

  async saveAsset(asset: LocalEvidenceAsset): Promise<void> {
    await this.putStore('assets', asset)
  }

  async getAsset(id: string): Promise<LocalEvidenceAsset | null> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readonly')
      const req = tx.objectStore('assets').get(id)
      req.onsuccess = () => resolve((req.result as LocalEvidenceAsset | undefined) ?? null)
      req.onerror = () => reject(req.error)
    })
  }

  async listAssetsForEvidence(evidenceId: string): Promise<LocalEvidenceAsset[]> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readonly')
      const req = tx.objectStore('assets').index('local_evidence_id').getAll(evidenceId)
      req.onsuccess = () => resolve((req.result as LocalEvidenceAsset[]) ?? [])
      req.onerror = () => reject(req.error)
    })
  }

  async listAssetsForPackage(packageId: string): Promise<LocalEvidenceAsset[]> {
    const records = await this.listRecordsForPackage(packageId)
    const assets: LocalEvidenceAsset[] = []
    for (const r of records) {
      assets.push(...(await this.listAssetsForEvidence(r.local_evidence_id)))
    }
    return assets
  }

  async saveLink(link: LocalEvidenceRequirementLink): Promise<void> {
    await this.putStore('links', link)
  }

  async listLinksForPackage(packageId: string): Promise<LocalEvidenceRequirementLink[]> {
    const records = await this.listRecordsForPackage(packageId)
    const ids = new Set(records.map((r) => r.local_evidence_id))
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('links', 'readonly')
      const req = tx.objectStore('links').getAll()
      req.onsuccess = () => {
        const rows = ((req.result as LocalEvidenceRequirementLink[]) ?? []).filter((l) =>
          ids.has(l.local_evidence_id),
        )
        resolve(rows)
      }
      req.onerror = () => reject(req.error)
    })
  }

  async saveEvent(event: LocalEvidenceEvent): Promise<void> {
    await this.putStore('events', event)
  }

  async listEvents(limit = 100): Promise<LocalEvidenceEvent[]> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('events', 'readonly')
      const req = tx.objectStore('events').getAll()
      req.onsuccess = () => resolve(((req.result as LocalEvidenceEvent[]) ?? []).slice(0, limit))
      req.onerror = () => reject(req.error)
    })
  }

  async saveBundle(bundle: LocalEvidenceBundle): Promise<void> {
    await this.putStore('bundles', bundle)
  }

  async getBundle(id: string): Promise<LocalEvidenceBundle | null> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('bundles', 'readonly')
      const req = tx.objectStore('bundles').get(id)
      req.onsuccess = () => resolve((req.result as LocalEvidenceBundle | undefined) ?? null)
      req.onerror = () => reject(req.error)
    })
  }

  async listBundles(status?: string): Promise<LocalEvidenceBundle[]> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('bundles', 'readonly')
      const store = tx.objectStore('bundles')
      const req = status ? store.index('status').getAll(status) : store.getAll()
      req.onsuccess = () => resolve((req.result as LocalEvidenceBundle[]) ?? [])
      req.onerror = () => reject(req.error)
    })
  }
}

export class OfflineEvidenceRepository {
  constructor(public storage: OfflineEvidenceStorageAdapter) {}

  static createDefault(): OfflineEvidenceRepository {
    if (typeof indexedDB !== 'undefined') {
      return new OfflineEvidenceRepository(new IndexedDbOfflineEvidenceStorage())
    }
    return new OfflineEvidenceRepository(new MemoryOfflineEvidenceStorage())
  }

  static createInMemory(): OfflineEvidenceRepository {
    return new OfflineEvidenceRepository(new MemoryOfflineEvidenceStorage())
  }

  saveRecord(r: LocalEvidenceRecord) {
    return this.storage.saveRecord(r)
  }
  getRecord(id: string) {
    return this.storage.getRecord(id)
  }
  listRecordsForPackage(packageId: string) {
    return this.storage.listRecordsForPackage(packageId)
  }
  listRecordsForTask(packageId: string, taskId: string) {
    return this.storage.listRecordsForTask(packageId, taskId)
  }
  saveAsset(a: LocalEvidenceAsset) {
    return this.storage.saveAsset(a)
  }
  getAsset(id: string) {
    return this.storage.getAsset(id)
  }
  listAssetsForEvidence(evidenceId: string) {
    return this.storage.listAssetsForEvidence(evidenceId)
  }
  listAssetsForPackage(packageId: string) {
    return this.storage.listAssetsForPackage(packageId)
  }
  saveLink(l: LocalEvidenceRequirementLink) {
    return this.storage.saveLink(l)
  }
  listLinksForPackage(packageId: string) {
    return this.storage.listLinksForPackage(packageId)
  }
  saveEvent(e: LocalEvidenceEvent) {
    return this.storage.saveEvent(e)
  }
  listEvents(limit?: number) {
    return this.storage.listEvents(limit)
  }
  saveBundle(b: LocalEvidenceBundle) {
    return this.storage.saveBundle(b)
  }
  getBundle(id: string) {
    return this.storage.getBundle(id)
  }
  listBundles(status?: string) {
    return this.storage.listBundles(status)
  }

  putBlob(ref: string, data: Uint8Array) {
    return this.storage.blobs.put(ref, data)
  }
  getBlob(ref: string) {
    return this.storage.blobs.get(ref)
  }
  deleteBlob(ref: string) {
    return this.storage.blobs.delete(ref)
  }
  estimateStorageBytes() {
    return this.storage.blobs.estimateBytes()
  }
}
