/**
 * Synthetic framework test plugin — in-memory repository.
 *
 * Pure fixtures (no external store). Registered into the server registry so the
 * generic service can resolve the type in tests. Never queried in runtime
 * because the type is disabled.
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
import type { SyntheticEnvironmentalEvent } from './event.types'

const SQUARE: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-90.5, 14.6],
      [-90.4, 14.6],
      [-90.4, 14.7],
      [-90.5, 14.7],
      [-90.5, 14.6],
    ],
  ],
}

function makeEvent(index: number): SyntheticEnvironmentalEvent {
  const iso = new Date('2026-01-01T00:00:00.000Z').toISOString()
  return {
    id: `synthetic-${index}`,
    eventType: 'synthetic_framework_test',
    title: `Evento sintético #${index}`,
    status: 'active',
    epistemicStatus: 'observed',
    classification: 'demo',
    geometry: SQUARE,
    firstObservedAt: iso,
    lastObservedAt: iso,
    observationCount: index,
    sourceIds: ['synthetic_source'],
    sourceNames: ['Fuente sintética'],
    attributes: { syntheticIndex: index, note: 'fixture de prueba' },
    createdAt: iso,
    updatedAt: iso,
    summary: 'Evento sintético para autopruebas del framework.',
    lifecycleState: 'persistent',
    persistence: 24,
  }
}

const FIXTURES: SyntheticEnvironmentalEvent[] = [makeEvent(1), makeEvent(2)]

export class SyntheticInMemoryRepository implements EnvironmentalEventRepository {
  async list(query: EnvironmentalEventQuery): Promise<EnvironmentalEventPage> {
    const limit = query.limit ?? 50
    return {
      items: FIXTURES,
      pagination: { page: 1, limit, total: FIXTURES.length },
      generatedAt: new Date().toISOString(),
    }
  }

  async getById(id: string): Promise<SyntheticEnvironmentalEvent | null> {
    return FIXTURES.find((e) => e.id === id) ?? null
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

  async summarize(): Promise<EventTypeSummarySnapshot> {
    return { activeCount: FIXTURES.length, newCount: FIXTURES.length, status: 'current' }
  }
}

export const syntheticRepository = new SyntheticInMemoryRepository()
export const syntheticFixtures = FIXTURES
