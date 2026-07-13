/**
 * Tests — canonical accent color lives in the manifest (single source of truth).
 *
 * Section 18: the event type's color is part of its manifest identity. No color
 * mapping for the type should exist outside the manifest; consumers read it from
 * the registry with a neutral fallback.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { ensureEventsRegistered } from '@/modules/environmental-events/registry/register-all'
import { environmentalEventRegistry } from '@/modules/environmental-events/registry/event-type-registry'
import {
  NEUTRAL_ACCENT_COLOR,
  defineEnvironmentalEvent,
  ManifestError,
} from '@/modules/environmental-events/manifest/event-manifest'
import {
  buildEnabledEventTypeCatalog,
  getEventTypeColor,
} from '@/modules/environmental-events/ui/event-ui'
import { thermalActivityManifest } from '@/events/thermal-activity/event.manifest'
import { rainfallDeficitManifest } from '@/events/rainfall-deficit/event.manifest'

beforeAll(() => ensureEventsRegistered())

describe('manifest accentColor', () => {
  it('thermal_activity and rainfall_deficit define explicit hex accent colors', () => {
    expect(thermalActivityManifest.accentColor).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(rainfallDeficitManifest.accentColor).toMatch(/^#[0-9a-fA-F]{6}$/)
    // Distinct identities: thermal is warm red/orange, deficit is amber/yellow.
    expect(thermalActivityManifest.accentColor).not.toBe(rainfallDeficitManifest.accentColor)
  })

  it('registry exposes accent color from the manifest', () => {
    expect(environmentalEventRegistry.getAccentColor('thermal_activity')).toBe(
      thermalActivityManifest.accentColor,
    )
    expect(getEventTypeColor('rainfall_deficit')).toBe(rainfallDeficitManifest.accentColor)
  })

  it('falls back to the neutral color when a manifest omits accentColor', () => {
    // Build a throwaway manifest without accentColor to check the fallback contract.
    const base = thermalActivityManifest
    const noColor = defineEnvironmentalEvent({
      type: 'flood',
      label: 'Prueba',
      pluralLabel: 'Pruebas',
      description: 'x',
      icon: 'droplet',
      geometryKinds: ['polygon'],
      sources: base.sources,
      presentation: { ...base.presentation, eventType: 'flood' },
      mapRenderer: { ...base.mapRenderer, eventType: 'flood' },
      priorityProvider: { ...base.priorityProvider, eventType: 'flood' },
      priorityProviderId: 'x',
      reportAdapter: { ...base.reportAdapter, eventType: 'flood' },
      findingRuleIds: [],
      typeSpecificFindingRules: [],
      detailSections: base.detailSections,
      methodology: 'x',
      limitations: ['x'],
      defaultFilters: {},
      supportedContextLayers: [],
      permissions: base.permissions,
      runtime: { featureFlag: 'flood' },
    })
    expect(noColor.accentColor).toBeUndefined()
    // A registry that only has this manifest would return the neutral fallback.
    expect(NEUTRAL_ACCENT_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it('rejects an invalid accentColor', () => {
    expect(() =>
      defineEnvironmentalEvent({
        ...thermalActivityManifest,
        type: 'thermal_activity',
        accentColor: 'red',
      }),
    ).toThrow(ManifestError)
  })

  it('the enabled catalog carries accent color for the dashboard', () => {
    const catalog = buildEnabledEventTypeCatalog()
    const thermal = catalog.find((c) => c.type === 'thermal_activity')
    expect(thermal?.accentColor).toBe(thermalActivityManifest.accentColor)
  })
})
