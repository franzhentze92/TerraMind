import { describe, expect, it } from 'vitest'
import type { FireEventListItemDto } from '@/modules/fires/types/fire.dto'
import {
  environmentalEventRegistry,
  registerThermalActivity,
  thermalActivityDefinition,
} from '@/modules/environmental-events'
import {
  EnvironmentalEventRegistry,
  RegistryError,
} from '@/modules/environmental-events/registry/event-type-registry'
import {
  defineEnvironmentalEvent,
  ManifestError,
} from '@/modules/environmental-events/manifest/event-manifest'
import {
  EnvironmentalFindingRuleRegistry,
  FindingRuleRegistryError,
} from '@/modules/environmental-events/registry/finding-rule-registry'
import {
  mapFireEventToEnvironmentalEvent,
  mapThermalEpistemic,
  mapThermalStatus,
} from '@/modules/environmental-events/thermal/thermal-event.mapper'
import { thermalPresentationAdapter } from '@/modules/environmental-events/thermal/thermal-presentation.adapter'
import { thermalMapRenderer } from '@/modules/environmental-events/thermal/thermal-map-renderer'
import { thermalPriorityFactorProvider } from '@/modules/environmental-events/thermal/thermal-priority-provider'
import { thermalFindingRules } from '@/modules/environmental-events/thermal/thermal-finding-rules'
import { buildActiveEventTypeCatalog } from '@/modules/environmental-events/national-situation/event-type-summary'
import type { EnvironmentalEvent } from '@/modules/environmental-events/types/environmental-event.types'

function sampleFireEvent(over: Partial<FireEventListItemDto> = {}): FireEventListItemDto {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    department_code: 'GT01',
    department_name: 'Petén',
    status: 'active',
    validation_status: 'probable',
    risk_level: 'atencion',
    priority_score: 72,
    centroid_lat: 16.9,
    centroid_lng: -89.9,
    first_detected_at: '2026-07-10T10:00:00.000Z',
    last_detected_at: '2026-07-10T18:00:00.000Z',
    persistence_hours: 8,
    detection_count: 5,
    satellite_count: 2,
    source_products: ['VIIRS_SNPP_NRT', 'MODIS_NRT'],
    max_frp_mw: 42.5,
    geometry_method: 'convex_hull_buffer',
    cross_department: false,
    created_at: '2026-07-10T10:05:00.000Z',
    ...over,
  }
}

describe('taxonomy mapping', () => {
  it('maps legacy thermal status to canonical status', () => {
    expect(mapThermalStatus('new')).toBe('detected')
    expect(mapThermalStatus('active')).toBe('active')
    expect(mapThermalStatus('monitoring')).toBe('monitoring')
    expect(mapThermalStatus('closed')).toBe('resolved')
  })

  it('maps validation to epistemic status', () => {
    expect(mapThermalEpistemic('confirmado')).toBe('verified')
    expect(mapThermalEpistemic('probable')).toBe('inferred')
    expect(mapThermalEpistemic('no_validado')).toBe('inferred')
  })
})

describe('EnvironmentalEventRegistry', () => {
  it('enables only thermal_activity at runtime; synthetic stays disabled', () => {
    registerThermalActivity()
    expect(environmentalEventRegistry.enabledTypes()).toEqual(['thermal_activity'])
    expect(environmentalEventRegistry.isEnabled('synthetic_framework_test')).toBe(false)
    // The synthetic plugin is registered structurally, proving auto-detection.
    expect(environmentalEventRegistry.registeredTypes()).toContain('synthetic_framework_test')
    expect(environmentalEventRegistry.has('flood')).toBe(false)
  })

  it('rejects duplicate registration', () => {
    const reg = new EnvironmentalEventRegistry()
    reg.registerManifest(thermalActivityDefinition)
    expect(() => reg.registerManifest(thermalActivityDefinition)).toThrow(RegistryError)
  })

  it('rejects incomplete manifests at definition time', () => {
    const broken = { ...thermalActivityDefinition, presentation: undefined } as never
    expect(() => defineEnvironmentalEvent(broken)).toThrow(ManifestError)
  })

  it('every registered type has presentation, map renderer, priority provider and sources', () => {
    for (const def of environmentalEventRegistry.list()) {
      expect(def.presentation.eventType).toBe(def.type)
      expect(def.mapRenderer.eventType).toBe(def.type)
      expect(def.priorityProvider.eventType).toBe(def.type)
      expect(def.reportAdapter.eventType).toBe(def.type)
      expect(def.sources.length).toBeGreaterThan(0)
      expect(def.detailSections.length).toBeGreaterThan(0)
      expect(def.geometryKinds.length).toBeGreaterThan(0)
    }
  })
})

describe('EnvironmentalFindingRuleRegistry', () => {
  it('indexes rules by event type and rejects duplicates', () => {
    const reg = new EnvironmentalFindingRuleRegistry()
    reg.registerMany(thermalFindingRules)
    expect(reg.forEventType('thermal_activity').length).toBe(thermalFindingRules.length)
    expect(() => reg.register(thermalFindingRules[0])).toThrow(FindingRuleRegistryError)
  })
})

describe('discriminated unions', () => {
  it('narrows attributes by eventType', () => {
    const event: EnvironmentalEvent = mapFireEventToEnvironmentalEvent(sampleFireEvent())
    if (event.eventType === 'thermal_activity') {
      expect(event.attributes.detectionCount).toBe(5)
    } else {
      throw new Error('expected thermal_activity')
    }
  })
})

describe('thermal mapper', () => {
  it('preserves canonical fields without changing numbers', () => {
    const src = sampleFireEvent()
    const event = mapFireEventToEnvironmentalEvent(src)
    expect(event.id).toBe(src.id)
    expect(event.eventType).toBe('thermal_activity')
    expect(event.geometry).toEqual({ type: 'Point', coordinates: [-89.9, 16.9] })
    expect(event.firstObservedAt).toBe(src.first_detected_at)
    expect(event.lastObservedAt).toBe(src.last_detected_at)
    expect(event.observationCount).toBe(src.detection_count)
    expect(event.attributes.detectionCount).toBe(src.detection_count)
    expect(event.attributes.satelliteCount).toBe(src.satellite_count)
    expect(event.attributes.maxFrp).toBe(src.max_frp_mw)
    expect(event.persistence).toBe(src.persistence_hours)
    expect(event.classification).toBe('operational')
    expect(event.attributes.legacy.priorityScore).toBe(src.priority_score)
  })

  it('flags missing geometry via metadata instead of faking coords', () => {
    const event = mapFireEventToEnvironmentalEvent(
      sampleFireEvent({ centroid_lat: null, centroid_lng: null }),
    )
    expect(event.metadata?.hasGeometry).toBe(false)
  })
})

describe('thermal presentation adapter', () => {
  const event = mapFireEventToEnvironmentalEvent(sampleFireEvent())

  it('produces Spanish deterministic display name and labels', () => {
    expect(thermalPresentationAdapter.getDisplayName(event)).toContain('Evento térmico')
    expect(thermalPresentationAdapter.getStatusLabel(event)).toBe('Activo')
    expect(thermalPresentationAdapter.getConfidenceLabel(event)).toBe('Probable')
    expect(thermalPresentationAdapter.getLimitations(event)[0]).toContain('detección térmica')
  })

  it('exposes key metrics for detections, sources and radiative energy', () => {
    const metrics = thermalPresentationAdapter.getKeyMetrics(event)
    const keys = metrics.map((m) => m.key)
    expect(keys).toContain('detections')
    expect(keys).toContain('satellites')
    expect(keys).toContain('max_frp')
  })
})

describe('thermal map renderer', () => {
  const event = mapFireEventToEnvironmentalEvent(sampleFireEvent())

  it('only declares point support and rejects polygons', () => {
    expect(thermalMapRenderer.supportedGeometryKinds).toContain('point')
    expect(thermalMapRenderer.supportsGeometry({ type: 'Point', coordinates: [0, 0] })).toBe(true)
    expect(
      thermalMapRenderer.supportsGeometry({ type: 'Polygon', coordinates: [] }),
    ).toBe(false)
  })

  it('builds feature + popup with radiative energy wording', () => {
    const feature = thermalMapRenderer.toMapFeature(event)
    expect(feature.type).toBe('Feature')
    const popup = thermalMapRenderer.getPopupModel(event)
    expect(popup.rows.some((r) => r.label === 'Energía radiativa')).toBe(true)
    expect(popup.disclaimer).toContain('detección térmica')
  })
})

describe('thermal priority factor provider', () => {
  it('surfaces qualitative factors without a numeric score', () => {
    const event = mapFireEventToEnvironmentalEvent(sampleFireEvent())
    const severity = thermalPriorityFactorProvider.getSeverityFactors(event, {})
    const persistence = thermalPriorityFactorProvider.getPersistenceFactors(event, {})
    expect(severity[0]?.domain).toBe('severity')
    expect(persistence[0]?.domain).toBe('persistence')
    // No factor object exposes a raw score.
    for (const f of [...severity, ...persistence]) {
      expect(f).not.toHaveProperty('score')
    }
  })
})

describe('national situation event-type catalog', () => {
  it('hides zero-count and unregistered types', () => {
    const items = buildActiveEventTypeCatalog([
      { type: 'thermal_activity', label: 'Actividad térmica', activeCount: 3 },
      { type: 'flood', label: 'Inundaciones', activeCount: 0 },
    ])
    expect(items).toHaveLength(1)
    expect(items[0].type).toBe('thermal_activity')
    expect(items[0].displayLine).toBe('Actividad térmica: 3 eventos')
  })
})
