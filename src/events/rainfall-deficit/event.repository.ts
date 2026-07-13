/**
 * Déficit de precipitación — repository (file-backed store).
 */
import type {
  EnvironmentalEventPage,
  EnvironmentalEventQuery,
} from '@/modules/environmental-events/types/environmental-event.types'
import type {
  EnvironmentalEventRepository,
  EventTypeSummarySnapshot,
  RelatedFindingRef,
  RelatedIncidentRef,
  RelatedPriorityRef,
} from '@/modules/environmental-events/contracts/repository'
import {
  loadRainfallDeficitStore,
  listEventsFromStore,
} from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.store'
import type { RainfallDeficitEnvironmentalEvent } from './event.types'

export class RainfallDeficitRepository implements EnvironmentalEventRepository {
  async list(query: EnvironmentalEventQuery): Promise<EnvironmentalEventPage> {
    const store = loadRainfallDeficitStore()
    return listEventsFromStore(store, query)
  }
  async getById(id: string): Promise<RainfallDeficitEnvironmentalEvent | null> {
    const store = loadRainfallDeficitStore()
    return store.events.find((e) => e.id === id) ?? null
  }
  async getRelatedFindings(): Promise<RelatedFindingRef[]> {
    return []
  }
  async getRelatedPriority(): Promise<RelatedPriorityRef> {
    return { id: null, attentionScore: null, attentionLevel: null }
  }
  async getRelatedIncident(): Promise<RelatedIncidentRef> {
    return { id: null, status: null }
  }

  /**
   * Per-type snapshot for Situación Nacional. Without this, the type never
   * appears in the dashboard's enabled-type list even when its feature flag is
   * on. Counts come from the file store: `activeCount` = active events;
   * `newCount` = events created within the requested window.
   */
  async summarize(windowHours: number): Promise<EventTypeSummarySnapshot> {
    const store = loadRainfallDeficitStore()
    const activeCount = store.events.filter((e) => e.status === 'active').length
    const cutoff = Date.now() - windowHours * 60 * 60 * 1000
    const newCount = store.events.filter((e) => {
      const t = Date.parse(e.createdAt)
      return Number.isFinite(t) && t >= cutoff
    }).length
    return { activeCount, newCount, status: 'current' }
  }
}

export const rainfallDeficitRepository = new RainfallDeficitRepository()
