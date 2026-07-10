import type {
  FieldFormResponseRecord,
  FieldFormRevisionSnapshot,
  LocalTaskProgress,
} from '@/modules/field-operations/field-forms/field-form.types'
import { fieldLocalDbName } from '@/core/auth/field-local-scope'

export interface FieldFormStorageAdapter {
  saveResponse(record: FieldFormResponseRecord): Promise<void>
  getResponse(responseId: string): Promise<FieldFormResponseRecord | null>
  listResponsesForPackage(packageId: string): Promise<FieldFormResponseRecord[]>
  listResponsesForTask(packageId: string, taskId: string): Promise<FieldFormResponseRecord[]>
  saveRevision(snapshot: FieldFormRevisionSnapshot): Promise<void>
  listRevisions(responseId: string): Promise<FieldFormRevisionSnapshot[]>
}

export class MemoryFieldFormStorage implements FieldFormStorageAdapter {
  private responses = new Map<string, FieldFormResponseRecord>()
  private revisions = new Map<string, FieldFormRevisionSnapshot[]>()

  async saveResponse(record: FieldFormResponseRecord): Promise<void> {
    this.responses.set(record.response_id, record)
  }

  async getResponse(responseId: string): Promise<FieldFormResponseRecord | null> {
    return this.responses.get(responseId) ?? null
  }

  async listResponsesForPackage(packageId: string): Promise<FieldFormResponseRecord[]> {
    return [...this.responses.values()]
      .filter((r) => r.package_id === packageId)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }

  async listResponsesForTask(packageId: string, taskId: string): Promise<FieldFormResponseRecord[]> {
    return [...this.responses.values()]
      .filter((r) => r.package_id === packageId && r.task_id === taskId)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }

  async saveRevision(snapshot: FieldFormRevisionSnapshot): Promise<void> {
    const list = this.revisions.get(snapshot.response_id) ?? []
    list.push(snapshot)
    this.revisions.set(snapshot.response_id, list)
  }

  async listRevisions(responseId: string): Promise<FieldFormRevisionSnapshot[]> {
    return [...(this.revisions.get(responseId) ?? [])].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    )
  }
}

const DB_NAME = 'terramind-field-forms'
const RESPONSES_STORE = 'responses'
const REVISIONS_STORE = 'revisions'
const DB_VERSION = 1

export class IndexedDbFieldFormStorage implements FieldFormStorageAdapter {
  private dbPromise: Promise<IDBDatabase> | null = null

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise
    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB no disponible'))
        return
      }
      const request = indexedDB.open(fieldLocalDbName('terramind-field-forms'), DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(RESPONSES_STORE)) {
          const store = db.createObjectStore(RESPONSES_STORE, { keyPath: 'response_id' })
          store.createIndex('package_id', 'package_id', { unique: false })
          store.createIndex('package_task', ['package_id', 'task_id'], { unique: false })
        }
        if (!db.objectStoreNames.contains(REVISIONS_STORE)) {
          const store = db.createObjectStore(REVISIONS_STORE, { keyPath: 'revision_id' })
          store.createIndex('response_id', 'response_id', { unique: false })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
    })
    return this.dbPromise
  }

  async saveResponse(record: FieldFormResponseRecord): Promise<void> {
    const db = await this.openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RESPONSES_STORE, 'readwrite')
      tx.objectStore(RESPONSES_STORE).put(record)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async getResponse(responseId: string): Promise<FieldFormResponseRecord | null> {
    const db = await this.openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(RESPONSES_STORE, 'readonly')
      const request = tx.objectStore(RESPONSES_STORE).get(responseId)
      request.onsuccess = () =>
        resolve((request.result as FieldFormResponseRecord | undefined) ?? null)
      request.onerror = () => reject(request.error)
    })
  }

  async listResponsesForPackage(packageId: string): Promise<FieldFormResponseRecord[]> {
    const db = await this.openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(RESPONSES_STORE, 'readonly')
      const index = tx.objectStore(RESPONSES_STORE).index('package_id')
      const request = index.getAll(packageId)
      request.onsuccess = () => {
        const rows = (request.result as FieldFormResponseRecord[]) ?? []
        resolve(rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at)))
      }
      request.onerror = () => reject(request.error)
    })
  }

  async listResponsesForTask(packageId: string, taskId: string): Promise<FieldFormResponseRecord[]> {
    const db = await this.openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(RESPONSES_STORE, 'readonly')
      const index = tx.objectStore(RESPONSES_STORE).index('package_task')
      const request = index.getAll([packageId, taskId])
      request.onsuccess = () => {
        const rows = (request.result as FieldFormResponseRecord[]) ?? []
        resolve(rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at)))
      }
      request.onerror = () => reject(request.error)
    })
  }

  async saveRevision(snapshot: FieldFormRevisionSnapshot): Promise<void> {
    const db = await this.openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(REVISIONS_STORE, 'readwrite')
      tx.objectStore(REVISIONS_STORE).put(snapshot)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async listRevisions(responseId: string): Promise<FieldFormRevisionSnapshot[]> {
    const db = await this.openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(REVISIONS_STORE, 'readonly')
      const index = tx.objectStore(REVISIONS_STORE).index('response_id')
      const request = index.getAll(responseId)
      request.onsuccess = () => {
        const rows = (request.result as FieldFormRevisionSnapshot[]) ?? []
        resolve(rows.sort((a, b) => b.created_at.localeCompare(a.created_at)))
      }
      request.onerror = () => reject(request.error)
    })
  }
}

export class FieldFormRepository {
  constructor(private storage: FieldFormStorageAdapter) {}

  static createDefault(): FieldFormRepository {
    if (typeof indexedDB !== 'undefined') {
      return new FieldFormRepository(new IndexedDbFieldFormStorage())
    }
    return new FieldFormRepository(new MemoryFieldFormStorage())
  }

  static createInMemory(): FieldFormRepository {
    return new FieldFormRepository(new MemoryFieldFormStorage())
  }

  saveResponse(record: FieldFormResponseRecord): Promise<void> {
    return this.storage.saveResponse(record)
  }

  getResponse(responseId: string): Promise<FieldFormResponseRecord | null> {
    return this.storage.getResponse(responseId)
  }

  listResponsesForPackage(packageId: string): Promise<FieldFormResponseRecord[]> {
    return this.storage.listResponsesForPackage(packageId)
  }

  listResponsesForTask(packageId: string, taskId: string): Promise<FieldFormResponseRecord[]> {
    return this.storage.listResponsesForTask(packageId, taskId)
  }

  saveRevision(snapshot: FieldFormRevisionSnapshot): Promise<void> {
    return this.storage.saveRevision(snapshot)
  }

  listRevisions(responseId: string): Promise<FieldFormRevisionSnapshot[]> {
    return this.storage.listRevisions(responseId)
  }

  async getActiveResponseForTask(
    packageId: string,
    taskId: string,
  ): Promise<FieldFormResponseRecord | null> {
    const rows = await this.listResponsesForTask(packageId, taskId)
    return (
      rows.find((r) => !['superseded', 'abandoned'].includes(r.status)) ??
      rows[0] ??
      null
    )
  }

  async computeTaskProgress(
    packageId: string,
    tasks: Array<{ id: string; task_type: string; schema_id?: string | null }>,
  ): Promise<LocalTaskProgress[]> {
    const progress: LocalTaskProgress[] = []
    for (const task of tasks) {
      const active = await this.getActiveResponseForTask(packageId, task.id)
      if (!active || active.status === 'not_started') {
        progress.push({
          task_id: task.id,
          status: 'not_started',
          response_id: active?.response_id ?? null,
          schema_id: task.schema_id ?? null,
        })
        continue
      }
      if (active.status === 'draft' || active.status === 'invalid') {
        progress.push({
          task_id: task.id,
          status: 'draft',
          response_id: active.response_id,
          schema_id: active.schema_id,
        })
        continue
      }
      if (active.status === 'complete_with_limitations') {
        progress.push({
          task_id: task.id,
          status: 'complete_with_limitations',
          response_id: active.response_id,
          schema_id: active.schema_id,
        })
        continue
      }
      if (['complete', 'locked'].includes(active.status)) {
        progress.push({
          task_id: task.id,
          status: 'complete',
          response_id: active.response_id,
          schema_id: active.schema_id,
        })
        continue
      }
      progress.push({
        task_id: task.id,
        status: 'blocked',
        response_id: active.response_id,
        schema_id: active.schema_id,
      })
    }
    return progress
  }
}
