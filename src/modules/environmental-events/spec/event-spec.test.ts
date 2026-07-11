import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  EventSpecError,
  parseEventSpec,
  parseMinimalYaml,
  validateEventSpec,
} from '@/modules/environmental-events/spec/event-spec'

const SPEC_DIR = resolve(process.cwd(), 'src/events/specs')

describe('minimal YAML parser', () => {
  it('parses nested maps and scalar lists', () => {
    const parsed = parseMinimalYaml(
      [
        'event:',
        '  type: flood',
        '  geometryKinds:',
        '    - polygon',
        '    - multipolygon',
        'priorityDimensions:',
        '  severity:',
        '    - flooded_area',
      ].join('\n'),
    ) as Record<string, any>
    expect(parsed.event.type).toBe('flood')
    expect(parsed.event.geometryKinds).toEqual(['polygon', 'multipolygon'])
    expect(parsed.priorityDimensions.severity).toEqual(['flooded_area'])
  })
})

describe('event spec loader', () => {
  it('loads and validates the thermal reference spec (yaml)', () => {
    const source = readFileSync(resolve(SPEC_DIR, 'thermal_activity.event.yaml'), 'utf8')
    const spec = parseEventSpec(source, 'yaml')
    expect(spec.event.type).toBe('thermal_activity')
    expect(spec.event.geometryKinds).toContain('point')
    expect(spec.findingRules).toContain('EVENT_PERSISTENT')
    expect(spec.priorityDimensions?.severity).toContain('max_frp')
  })

  it('loads and validates the flood example spec (yaml)', () => {
    const source = readFileSync(resolve(SPEC_DIR, 'flood.event.yaml'), 'utf8')
    const spec = parseEventSpec(source, 'yaml')
    expect(spec.event.type).toBe('flood')
    expect(spec.event.geometryKinds).toEqual(['polygon', 'multipolygon'])
    expect(spec.sources).toEqual(['sentinel_1', 'chirps'])
  })

  it('supports JSON specs equivalently', () => {
    const spec = parseEventSpec(
      JSON.stringify({
        event: { type: 'flood', label: 'Inundación', pluralLabel: 'Inundaciones', geometryKinds: ['polygon'] },
        sources: ['sentinel_1'],
      }),
      'json',
    )
    expect(spec.event.label).toBe('Inundación')
  })

  it('rejects incomplete specs', () => {
    expect(() => validateEventSpec({ event: { type: 'x' } })).toThrow(EventSpecError)
  })

  it('rejects unknown geometry kinds', () => {
    expect(() =>
      validateEventSpec({
        event: { type: 'x', label: 'X', pluralLabel: 'Xs', geometryKinds: ['blob'] },
      }),
    ).toThrow(EventSpecError)
  })
})
