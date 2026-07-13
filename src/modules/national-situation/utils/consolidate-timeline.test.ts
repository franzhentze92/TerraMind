import { describe, expect, it } from 'vitest'
import { consolidateTimelineEntries } from './consolidate-timeline'

describe('consolidateTimelineEntries', () => {
  it('collapses consecutive same-event/location entries into the most recent', () => {
    const entries = [
      { stage: 'event', summary: 'Actividad térmica agrupada en Sacatepéquez', timestamp: '2026-07-11T20:00:00.000Z' },
      { stage: 'event', summary: 'Actividad térmica agrupada en Sacatepéquez', timestamp: '2026-07-11T18:00:00.000Z' },
      { stage: 'event', summary: 'Actividad térmica agrupada en Petén', timestamp: '2026-07-11T12:00:00.000Z' },
    ]
    const out = consolidateTimelineEntries(entries)
    expect(out).toHaveLength(2)
    // Keeps the most recent Sacatepéquez, plus the distinct Petén.
    expect(out[0].timestamp).toBe('2026-07-11T20:00:00.000Z')
    expect(out[1].summary).toContain('Petén')
  })

  it('does not merge distinct stages with the same title', () => {
    const entries = [
      { stage: 'incident', summary: 'Evento X', timestamp: '2026-07-11T20:00:00.000Z' },
      { stage: 'event', summary: 'Evento X', timestamp: '2026-07-11T19:30:00.000Z' },
    ]
    expect(consolidateTimelineEntries(entries)).toHaveLength(2)
  })

  it('does not merge same title far apart in time', () => {
    const entries = [
      { stage: 'event', summary: 'Actividad térmica agrupada en Izabal', timestamp: '2026-07-11T20:00:00.000Z' },
      { stage: 'event', summary: 'Actividad térmica agrupada en Izabal', timestamp: '2026-07-09T20:00:00.000Z' },
    ]
    expect(consolidateTimelineEntries(entries)).toHaveLength(2)
  })

  it('does not consolidate distinct consecutive milestones', () => {
    const entries = [
      { stage: 'finding', summary: 'Hallazgo A', timestamp: '2026-07-11T20:00:00.000Z' },
      { stage: 'finding', summary: 'Hallazgo B', timestamp: '2026-07-11T19:00:00.000Z' },
    ]
    expect(consolidateTimelineEntries(entries)).toHaveLength(2)
  })
})
