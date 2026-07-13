import { describe, expect, it } from 'vitest'
import { timelineEntryTitle } from './timeline-title'

describe('timelineEntryTitle', () => {
  it('keeps a descriptive summary with real location', () => {
    expect(
      timelineEntryTitle({ summary: 'Actividad térmica agrupada en Petén', stage_label: 'Evento' }),
    ).toBe('Actividad térmica agrupada en Petén')
  })

  it('normalizes legacy generic wording to the current vocabulary', () => {
    expect(timelineEntryTitle({ summary: 'Evento térmico agrupado', stage_label: 'Evento' })).toBe(
      'Actividad térmica agrupada',
    )
    expect(
      timelineEntryTitle({ summary: 'Detección térmica registrada', stage_label: 'Observación' }),
    ).toBe('Nueva detección térmica')
  })

  it('falls back to the milestone label without inventing a location', () => {
    expect(timelineEntryTitle({ summary: '', stage_label: 'Hallazgo' })).toBe('Hallazgo')
    expect(timelineEntryTitle({ summary: undefined, stage_label: '' })).toBe('Actividad registrada')
  })

  it('is deterministic for the same input', () => {
    const entry = { summary: 'Incidente forestal · 3 evento(s)', stage_label: 'Incidente' }
    expect(timelineEntryTitle(entry)).toBe(timelineEntryTitle(entry))
  })
})
