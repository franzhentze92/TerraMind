import { describe, expect, it } from 'vitest'
import {
  eventQualifiesForLandCoverJob,
} from '@/pipeline/engines/fire/context/land-cover-jobs.engine'
import {
  eventNeedsLandCoverEnrichment,
} from '@/pipeline/engines/fire/context/land-cover.engine'
import type { LandCoverEventCandidate } from '@/pipeline/stores/land-cover.store'

const baseEvent: LandCoverEventCandidate = {
  id: 'evt-1',
  department_name: 'Petén',
  status: 'active',
  detection_count: 2,
  centroid_lat: 16.9,
  centroid_lng: -90.5,
  last_linked_at: '2026-07-10T08:00:00.000Z',
  context_version: 'v-current',
  context_generated_at: '2026-07-10T09:00:00.000Z',
}

describe('land-cover job eligibility', () => {
  it('no requiere job si el contexto está vigente', () => {
    expect(eventNeedsLandCoverEnrichment(baseEvent, 'v-current', false)).toBe(false)
    expect(eventQualifiesForLandCoverJob(baseEvent, 'v-current', false)).toBe(false)
  })

  it('requiere job sin contexto', () => {
    const event = { ...baseEvent, context_version: null, context_generated_at: null }
    expect(eventNeedsLandCoverEnrichment(event, 'v-current', false)).toBe(true)
    expect(eventQualifiesForLandCoverJob(event, 'v-current', false)).toBe(true)
  })

  it('requiere job con detección nueva', () => {
    const event = {
      ...baseEvent,
      last_linked_at: '2026-07-10T12:00:00.000Z',
      context_generated_at: '2026-07-10T09:00:00.000Z',
    }
    expect(eventNeedsLandCoverEnrichment(event, 'v-current', false)).toBe(true)
  })

  it('requiere job con context_version nueva', () => {
    expect(eventNeedsLandCoverEnrichment(baseEvent, 'v-next', false)).toBe(true)
  })

  it('no crea job para evento cerrado sin cambios', () => {
    const closed = { ...baseEvent, status: 'closed' }
    expect(eventQualifiesForLandCoverJob(closed, 'v-current', false)).toBe(false)
  })
})
