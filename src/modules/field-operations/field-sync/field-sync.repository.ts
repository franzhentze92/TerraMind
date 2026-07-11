import { randomUUID } from 'node:crypto'

import type {
  AssetUploadSession,
  RemoteObjectMapping,
  SyncConflict,
  SyncOperation,
  SyncSession,
} from '@/modules/field-operations/field-sync/field-sync.types'
import { fieldLocalDbName } from '@/core/auth/field-local-scope'

export interface FieldSyncStorageAdapter {
  saveSession(session: SyncSession): Promise<void>
  getSession(id: string): Promise<SyncSession | null>
  getSessionByBundle(bundleId: string, bundleChecksum: string): Promise<SyncSession | null>
  listSessions(status?: string): Promise<SyncSession[]>
  saveOperation(op: SyncOperation): Promise<void>
  getOperation(id: string): Promise<SyncOperation | null>
  listOperationsForSession(sessionId: string): Promise<SyncOperation[]>
  saveUploadSession(session: AssetUploadSession): Promise<void>
  getUploadSession(id: string): Promise<AssetUploadSession | null>
  listUploadSessionsForSession(syncSessionId: string): Promise<AssetUploadSession[]>
  saveConflict(conflict: SyncConflict): Promise<void>
  listConflictsForSession(sessionId: string): Promise<SyncConflict[]>
  saveMapping(mapping: RemoteObjectMapping): Promise<void>
  listMappingsForBundle(bundleId: string): Promise<RemoteObjectMapping[]>
}

export class MemoryFieldSyncStorage implements FieldSyncStorageAdapter {
  sessions = new Map<string, SyncSession>()
  operations = new Map<string, SyncOperation>()
  uploadSessions = new Map<string, AssetUploadSession>()
  conflicts: SyncConflict[] = []
  mappings = new Map<string, RemoteObjectMapping>()

  async saveSession(session: SyncSession) {
    this.sessions.set(session.session_id, session)
  }
  async getSession(id: string) {
    return this.sessions.get(id) ?? null
  }
  async getSessionByBundle(bundleId: string, bundleChecksum: string) {
    return (
      [...this.sessions.values()].find(
        (s) => s.bundle_id === bundleId && s.bundle_checksum === bundleChecksum && !s.cancelled,
      ) ?? null
    )
  }
  async listSessions(status?: string) {
    const all = [...this.sessions.values()]
    return status ? all.filter((s) => s.status === status) : all
  }
  async saveOperation(op: SyncOperation) {
    this.operations.set(op.operation_id, op)
  }
  async getOperation(id: string) {
    return this.operations.get(id) ?? null
  }
  async listOperationsForSession(sessionId: string) {
    return [...this.operations.values()]
      .filter((o) => o.session_id === sessionId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  async saveUploadSession(session: AssetUploadSession) {
    this.uploadSessions.set(session.upload_session_id, session)
  }
  async getUploadSession(id: string) {
    return this.uploadSessions.get(id) ?? null
  }
  async listUploadSessionsForSession(syncSessionId: string) {
    return [...this.uploadSessions.values()].filter((s) => s.sync_session_id === syncSessionId)
  }
  async saveConflict(conflict: SyncConflict) {
    this.conflicts = this.conflicts.filter((c) => c.conflict_id !== conflict.conflict_id)
    this.conflicts.push(conflict)
  }
  async listConflictsForSession(sessionId: string) {
    return this.conflicts.filter((c) => c.session_id === sessionId)
  }
  async saveMapping(mapping: RemoteObjectMapping) {
    this.mappings.set(mapping.mapping_id, mapping)
  }
  async listMappingsForBundle(bundleId: string) {
    return [...this.mappings.values()].filter((m) => m.bundle_id === bundleId)
  }
}
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(fieldLocalDbName('terramind-field-sync'), DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('sessions')) {
        const s = db.createObjectStore('sessions', { keyPath: 'session_id' })
        s.createIndex('bundle', ['bundle_id', 'bundle_checksum'], { unique: false })
        s.createIndex('status', 'status', { unique: false })
      }
      if (!db.objectStoreNames.contains('operations')) {
        const s = db.createObjectStore('operations', { keyPath: 'operation_id' })
        s.createIndex('session_id', 'session_id', { unique: false })
      }
      if (!db.objectStoreNames.contains('upload_sessions')) {
        db.createObjectStore('upload_sessions', { keyPath: 'upload_session_id' })
      }
      if (!db.objectStoreNames.contains('conflicts')) db.createObjectStore('conflicts', { keyPath: 'conflict_id' })
      if (!db.objectStoreNames.contains('mappings')) db.createObjectStore('mappings', { keyPath: 'mapping_id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function putStore(store: string, value: unknown) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(value)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function getAll<T>(store: string): Promise<T[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve((req.result as T[]) ?? [])
    req.onerror = () => reject(req.error)
  })
}

export class IndexedDbFieldSyncStorage implements FieldSyncStorageAdapter {
  async saveSession(session: SyncSession) {
    await putStore('sessions', session)
  }
  async getSession(id: string) {
    const db = await openDb()
    return new Promise<SyncSession | null>((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly')
      const req = tx.objectStore('sessions').get(id)
      req.onsuccess = () => resolve((req.result as SyncSession | undefined) ?? null)
      req.onerror = () => reject(req.error)
    })
  }
  async getSessionByBundle(bundleId: string, bundleChecksum: string) {
    const all = await getAll<SyncSession>('sessions')
    return (
      all.find(
        (s) => s.bundle_id === bundleId && s.bundle_checksum === bundleChecksum && !s.cancelled,
      ) ?? null
    )
  }
  async listSessions(status?: string) {
    const all = await getAll<SyncSession>('sessions')
    return status ? all.filter((s) => s.status === status) : all
  }
  async saveOperation(op: SyncOperation) {
    await putStore('operations', op)
  }
  async getOperation(id: string) {
    const db = await openDb()
    return new Promise<SyncOperation | null>((resolve, reject) => {
      const tx = db.transaction('operations', 'readonly')
      const req = tx.objectStore('operations').get(id)
      req.onsuccess = () => resolve((req.result as SyncOperation | undefined) ?? null)
      req.onerror = () => reject(req.error)
    })
  }
  async listOperationsForSession(sessionId: string) {
    const all = await getAll<SyncOperation>('operations')
    return all.filter((o) => o.session_id === sessionId).sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  async saveUploadSession(session: AssetUploadSession) {
    await putStore('upload_sessions', session)
  }
  async getUploadSession(id: string) {
    const db = await openDb()
    return new Promise<AssetUploadSession | null>((resolve, reject) => {
      const tx = db.transaction('upload_sessions', 'readonly')
      const req = tx.objectStore('upload_sessions').get(id)
      req.onsuccess = () => resolve((req.result as AssetUploadSession | undefined) ?? null)
      req.onerror = () => reject(req.error)
    })
  }
  async listUploadSessionsForSession(syncSessionId: string) {
    const all = await getAll<AssetUploadSession>('upload_sessions')
    return all.filter((s) => s.sync_session_id === syncSessionId)
  }
  async saveConflict(conflict: SyncConflict) {
    await putStore('conflicts', conflict)
  }
  async listConflictsForSession(sessionId: string) {
    const all = await getAll<SyncConflict>('conflicts')
    return all.filter((c) => c.session_id === sessionId)
  }
  async saveMapping(mapping: RemoteObjectMapping) {
    await putStore('mappings', mapping)
  }
  async listMappingsForBundle(bundleId: string) {
    const all = await getAll<RemoteObjectMapping>('mappings')
    return all.filter((m) => m.bundle_id === bundleId)
  }
}

export class FieldSyncRepository {
  constructor(public storage: FieldSyncStorageAdapter) {}

  static createDefault() {
    if (typeof indexedDB !== 'undefined') {
      return new FieldSyncRepository(new IndexedDbFieldSyncStorage())
    }
    return new FieldSyncRepository(new MemoryFieldSyncStorage())
  }

  static createInMemory() {
    return new FieldSyncRepository(new MemoryFieldSyncStorage())
  }

  newId(prefix: string) {
    return `${prefix}-${randomUUID()}`
  }

  saveSession = (s: SyncSession) => this.storage.saveSession(s)
  getSession = (id: string) => this.storage.getSession(id)
  getSessionByBundle = (bundleId: string, checksum: string) =>
    this.storage.getSessionByBundle(bundleId, checksum)
  listSessions = (status?: string) => this.storage.listSessions(status)
  saveOperation = (o: SyncOperation) => this.storage.saveOperation(o)
  getOperation = (id: string) => this.storage.getOperation(id)
  listOperationsForSession = (id: string) => this.storage.listOperationsForSession(id)
  saveUploadSession = (s: AssetUploadSession) => this.storage.saveUploadSession(s)
  getUploadSession = (id: string) => this.storage.getUploadSession(id)
  listUploadSessionsForSession = (id: string) => this.storage.listUploadSessionsForSession(id)
  saveConflict = (c: SyncConflict) => this.storage.saveConflict(c)
  listConflictsForSession = (id: string) => this.storage.listConflictsForSession(id)
  saveMapping = (m: RemoteObjectMapping) => this.storage.saveMapping(m)
  listMappingsForBundle = (bundleId: string) => this.storage.listMappingsForBundle(bundleId)
}
