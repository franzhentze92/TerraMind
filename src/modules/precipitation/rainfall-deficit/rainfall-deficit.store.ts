/**
 * Rainfall deficit — file-based persistence (non-destructive, idempotent).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { RainfallDeficitEnvironmentalEvent } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.types'
import type { RainfallDeficitObservation } from '@/modules/precipitation/chirps-v3/chirps-v3.observations'
import type {
  EnvironmentalEventPage,
  EnvironmentalEventQuery,
} from '@/modules/environmental-events/types/environmental-event.types'

export const RAINFALL_DEFICIT_STORE_ROOT = resolve(process.cwd(), 'data/climate/chirps/v3/processed')
export const EVENTS_PATH = resolve(RAINFALL_DEFICIT_STORE_ROOT, 'events.json')
export const OBSERVATIONS_PATH = resolve(RAINFALL_DEFICIT_STORE_ROOT, 'observations.json')
export const CELL_STATE_PATH = resolve(RAINFALL_DEFICIT_STORE_ROOT, 'cell-state.json')

export interface RainfallDeficitStore {
  version: number
  events: RainfallDeficitEnvironmentalEvent[]
  observations: RainfallDeficitObservation[]
  cellConsecutivePentads: Record<string, number>
  updatedAt: string
}

function emptyStore(): RainfallDeficitStore {
  return {
    version: 1,
    events: [],
    observations: [],
    cellConsecutivePentads: {},
    updatedAt: new Date().toISOString(),
  }
}

export function loadRainfallDeficitStore(): RainfallDeficitStore {
  mkdirSync(RAINFALL_DEFICIT_STORE_ROOT, { recursive: true })
  if (!existsSync(EVENTS_PATH)) return emptyStore()
  try {
    return JSON.parse(readFileSync(EVENTS_PATH, 'utf8')) as RainfallDeficitStore
  } catch {
    return emptyStore()
  }
}

export function saveRainfallDeficitStore(store: RainfallDeficitStore): void {
  mkdirSync(RAINFALL_DEFICIT_STORE_ROOT, { recursive: true })
  store.updatedAt = new Date().toISOString()
  writeFileSync(EVENTS_PATH, JSON.stringify(store, null, 2), 'utf8')
}

export function mergeObservationsIdempotent(
  existing: RainfallDeficitObservation[],
  incoming: RainfallDeficitObservation[],
): RainfallDeficitObservation[] {
  const byId = new Map(existing.map((o) => [o.id, o]))
  for (const obs of incoming) {
    const prev = byId.get(obs.id)
    if (!prev) {
      byId.set(obs.id, obs)
      continue
    }
    // Preliminary → Final: replace when final arrives (preserve audit via receivedAt)
    if (
      prev.attributes.productStatus === 'preliminary' &&
      obs.attributes.productStatus === 'final'
    ) {
      byId.set(obs.id, obs)
    }
  }
  return [...byId.values()]
}

export function listEventsFromStore(
  store: RainfallDeficitStore,
  query: EnvironmentalEventQuery,
): EnvironmentalEventPage {
  let items = store.events
  if (query.status) items = items.filter((e) => e.status === query.status)
  if (query.lifecycle) items = items.filter((e) => e.lifecycleState === query.lifecycle)
  const page = query.page ?? 1
  const limit = query.limit ?? 50
  const start = (page - 1) * limit
  const slice = items.slice(start, start + limit)
  return {
    items: slice,
    pagination: { page, limit, total: items.length },
    generatedAt: new Date().toISOString(),
  }
}

export function upsertEvents(
  existing: RainfallDeficitEnvironmentalEvent[],
  updated: RainfallDeficitEnvironmentalEvent[],
): RainfallDeficitEnvironmentalEvent[] {
  const byId = new Map(existing.map((e) => [e.id, e]))
  for (const ev of updated) byId.set(ev.id, ev)
  return [...byId.values()]
}
