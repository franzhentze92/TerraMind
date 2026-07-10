import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { TerraMindStore } from '@/pipeline/types'

const EMPTY_STORE: TerraMindStore = {
  observations: [],
  eventos: [],
  hallazgos: [],
  expedientes: [],
  hipotesis: [],
  evidencias: [],
  prioridades: [],
  riesgos: [],
  estrategias: [],
  timeline: [],
  hallazgoSequence: 0,
  firmsHealth: { status: 'unconfigured' },
}

function getStorePath(): string {
  const dataDir = process.env.TERRAMIND_DATA_DIR ?? join(process.cwd(), 'data')
  return join(dataDir, 'terramind-store.json')
}

/**
 * File-based persistence for Sprint 1.
 * Production: PostgreSQL + PostGIS.
 */
export class FileStore {
  private store: TerraMindStore
  private path: string

  constructor() {
    this.path = getStorePath()
    this.store = this.load()
  }

  private load(): TerraMindStore {
    try {
      if (!existsSync(this.path)) return { ...EMPTY_STORE }
      const raw = readFileSync(this.path, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<TerraMindStore>
      return {
        ...EMPTY_STORE,
        ...parsed,
        firmsHealth: { ...EMPTY_STORE.firmsHealth, ...(parsed.firmsHealth ?? {}) },
      }
    } catch {
      return { ...EMPTY_STORE }
    }
  }

  save(): void {
    const dir = dirname(this.path)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(this.path, JSON.stringify(this.store, null, 2), 'utf-8')
  }

  get(): TerraMindStore {
    return this.store
  }

  update(mutator: (store: TerraMindStore) => TerraMindStore): TerraMindStore {
    this.store = mutator(this.store)
    this.save()
    return this.store
  }

  reset(): void {
    this.store = { ...EMPTY_STORE }
    this.save()
  }
}

let instance: FileStore | null = null

export function getStore(): FileStore {
  if (!instance) instance = new FileStore()
  return instance
}
