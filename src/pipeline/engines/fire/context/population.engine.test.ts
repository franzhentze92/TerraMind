import { describe, expect, it } from 'vitest'

import {
  eventNeedsPopulationEnrichment,
} from '@/pipeline/engines/fire/context/population.engine'
import type { PopulationEventCandidate } from '@/pipeline/stores/population.store'

function candidate(overrides: Partial<PopulationEventCandidate> = {}): PopulationEventCandidate {
  return {
    id: 'evt-1',
    department_code: '11',
    department_name: 'Retalhuleu',
    status: 'active',
    detection_count: 3,
    centroid_lat: 14.5,
    centroid_lng: -91.7,
    last_linked_at: null,
    context_version: null,
    context_generated_at: null,
    ...overrides,
  }
}

describe('population.engine eligibility', () => {
  it('needs enrichment when no context', () => {
    expect(eventNeedsPopulationEnrichment(candidate(), 'v2', false)).toBe(true)
  })

  it('unchanged when context version matches and no new detections', () => {
    expect(
      eventNeedsPopulationEnrichment(
        candidate({
          context_version: 'v2',
          context_generated_at: '2026-07-10T10:00:00.000Z',
          last_linked_at: '2026-07-10T09:00:00.000Z',
        }),
        'v2',
        false,
      ),
    ).toBe(false)
  })

  it('needs enrichment when detections linked after context', () => {
    expect(
      eventNeedsPopulationEnrichment(
        candidate({
          context_version: 'v2',
          context_generated_at: '2026-07-10T09:00:00.000Z',
          last_linked_at: '2026-07-10T11:00:00.000Z',
        }),
        'v2',
        false,
      ),
    ).toBe(true)
  })

  it('force always enriches', () => {
    expect(
      eventNeedsPopulationEnrichment(
        candidate({ context_version: 'v2', context_generated_at: '2026-07-10T12:00:00.000Z' }),
        'v2',
        true,
      ),
    ).toBe(true)
  })
})
