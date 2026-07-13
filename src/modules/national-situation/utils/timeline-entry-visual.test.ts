import { beforeAll, describe, expect, it } from 'vitest'
import { ensureEventsRegistered } from '@/modules/environmental-events/registry/register-all'
import { environmentalEventRegistry } from '@/modules/environmental-events/registry/event-type-registry'
import { resolveTimelineEntryVisual } from './timeline-entry-visual'

beforeAll(() => ensureEventsRegistered())

describe('resolveTimelineEntryVisual', () => {
  it('uses registry colors for thermal events', () => {
    const visual = resolveTimelineEntryVisual({
      id: '1',
      timestamp: '2026-07-11T08:30:00.000Z',
      stage: 'event',
      stage_label: 'Evento',
      status: 'active',
      source: 'FIRMS',
      confidence: 'high',
      summary: 'Actividad térmica agrupada en Petén',
      epistemic: 'inferred',
    })

    expect(visual.eventType).toBe('thermal_activity')
    expect(visual.accentColor).toBe(environmentalEventRegistry.getAccentColor('thermal_activity'))
    expect(visual.iconKey).toBe('flame')
  })

  it('uses rainfall deficit manifest for drought milestones', () => {
    const visual = resolveTimelineEntryVisual({
      id: '2',
      timestamp: '2026-07-11T07:45:00.000Z',
      stage: 'event',
      stage_label: 'Evento',
      status: 'active',
      source: 'CHIRPS',
      confidence: 'high',
      summary: 'Déficit de precipitación persistente en Jalapa',
      epistemic: 'observed',
    })

    expect(visual.eventType).toBe('rainfall_deficit')
    expect(visual.iconKey).toBe('cloud-rain')
    expect(visual.accentColor).toBe('#f59e0b')
  })

  it('uses blue waves styling for flood summaries', () => {
    const visual = resolveTimelineEntryVisual({
      id: '3',
      timestamp: '2026-07-11T06:40:00.000Z',
      stage: 'incident',
      stage_label: 'Incidente',
      status: 'active',
      source: 'x',
      confidence: 'medium',
      summary: 'Inundaciones locales en Izabal',
      epistemic: 'inferred',
    })

    expect(visual.iconKey).toBe('waves')
    expect(visual.accentColor).toBe('#38bdf8')
  })

  it('uses green target for priority milestones', () => {
    const visual = resolveTimelineEntryVisual({
      id: '4',
      timestamp: '2026-07-11T05:50:00.000Z',
      stage: 'finding',
      stage_label: 'Hallazgo',
      status: 'active',
      source: 'x',
      confidence: 'high',
      summary: 'Prioridad actualizada por exposición agrícola',
      epistemic: 'recommended',
    })

    expect(visual.accentColor).toBe('#86efac')
    expect(visual.fallbackIcon).toBeDefined()
  })

  it('uses blue check styling for verification text', () => {
    const visual = resolveTimelineEntryVisual({
      id: '5',
      timestamp: '2026-07-11T04:20:00.000Z',
      stage: 'mission',
      stage_label: 'Misión',
      status: 'completed',
      source: 'x',
      confidence: 'high',
      summary: 'Verificación completada en Alta Verapaz',
      epistemic: 'verified',
    })

    expect(visual.accentColor).toBe('#60a5fa')
  })
})
