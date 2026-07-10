import { describe, expect, it } from 'vitest'

import { eventNeedsClimateEnrichment } from '@/pipeline/engines/fire/context/climate.engine'
import type { ClimateEventCandidate } from '@/pipeline/stores/climate.store'

describe('climate.engine eligibility', () => {
  const base: ClimateEventCandidate = {
    id: 'evt-1',
    department_code: '01',
    department_name: 'Guatemala',
    status: 'active',
    detection_count: 2,
    centroid_lat: 14.6,
    centroid_lng: -90.5,
    first_detected_at: '2026-01-01T00:00:00Z',
    last_detected_at: '2026-01-02T00:00:00Z',
    last_linked_at: null,
    context_version: null,
    context_generated_at: null,
  }

  it('needs enrichment when no context', () => {
    expect(eventNeedsClimateEnrichment(base, 'v1', false)).toBe(true)
  })

  it('needs enrichment when detections newer than context', () => {
    expect(
      eventNeedsClimateEnrichment(
        {
          ...base,
          context_version: 'v1',
          context_generated_at: '2026-01-01T00:00:00Z',
          last_linked_at: '2026-01-03T00:00:00Z',
        },
        'v1',
        false,
      ),
    ).toBe(true)
  })
})
