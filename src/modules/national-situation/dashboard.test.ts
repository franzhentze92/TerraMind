/**
 * Tests — Situación Nacional future-state dashboard (registry-driven).
 *
 * Node-environment logic tests (no DOM): validate the registry-driven type
 * visibility, canonical color/icon sourcing, detail routing and the 340-municipio
 * UI contract that the dashboard depends on.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { Activity, CloudRain, Flame } from 'lucide-react'
import { ensureEventsRegistered } from '@/modules/environmental-events/registry/register-all'
import { environmentalEventRegistry } from '@/modules/environmental-events/registry/event-type-registry'
import { buildEnabledEventTypeCatalog, getEventTypeColor } from '@/modules/environmental-events/ui/event-ui'
import { resolveEventTypeIcon } from '@/modules/environmental-events/ui/EventTypeIcon'
import { eventDetailHref } from './utils/event-detail-href'
import {
  GUATEMALA_MUNICIPALITY_COUNT,
  ADM2_LAKE_PCODES,
} from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.municipal'

beforeAll(() => ensureEventsRegistered())

describe('dashboard event-type visibility (registry-driven)', () => {
  it('thermal is enabled by default; rainfall deficit is not', () => {
    expect(environmentalEventRegistry.isEnabled('thermal_activity')).toBe(true)
    expect(environmentalEventRegistry.get('rainfall_deficit').runtime.enabledByDefault).toBe(false)
  })

  it('client enabled catalog does not leak disabled types', () => {
    const catalog = buildEnabledEventTypeCatalog()
    expect(catalog.some((c) => c.type === 'thermal_activity')).toBe(true)
    // rainfall deficit is registered but disabled on the client (flag lives on the server)
    expect(catalog.some((c) => c.type === 'rainfall_deficit')).toBe(false)
  })

  it('color and icon come from the manifest for every registered type', () => {
    expect(getEventTypeColor('thermal_activity')).toBe('#f97316')
    expect(getEventTypeColor('rainfall_deficit')).toBe('#f59e0b')
    expect(environmentalEventRegistry.getIcon('thermal_activity')).toBe('flame')
    expect(environmentalEventRegistry.getIcon('rainfall_deficit')).toBe('cloud-rain')
  })
})

describe('event type icon resolver', () => {
  it('maps known manifest icon keys to lucide components', () => {
    expect(resolveEventTypeIcon('flame')).toBe(Flame)
    expect(resolveEventTypeIcon('cloud-rain')).toBe(CloudRain)
  })

  it('falls back to a neutral icon for unknown keys', () => {
    expect(resolveEventTypeIcon('not-a-real-icon')).toBe(Activity)
  })
})

describe('event detail routing', () => {
  it('thermal keeps its dedicated route; other types use the generic route', () => {
    expect(eventDetailHref('thermal_activity', 'abc')).toBe('/incendios/abc')
    expect(eventDetailHref('rainfall_deficit', 'xyz')).toBe('/eventos/xyz')
  })
})

describe('ADM2 municipal UI contract', () => {
  it('public municipal count is 340 (two lakes excluded)', () => {
    expect(GUATEMALA_MUNICIPALITY_COUNT).toBe(340)
    expect(ADM2_LAKE_PCODES).toHaveLength(2)
  })
})
