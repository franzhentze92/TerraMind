/**
 * Déficit de precipitación — repository (file-backed store).
 */
import type {
  EnvironmentalEventPage,
  EnvironmentalEventQuery,
} from '@/modules/environmental-events/types/environmental-event.types'
import type {
  EnvironmentalEventRepository,
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
}

export const rainfallDeficitRepository = new RainfallDeficitRepository()
