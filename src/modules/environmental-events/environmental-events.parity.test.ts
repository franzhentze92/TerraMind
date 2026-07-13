import { describe, expect, it } from 'vitest'
import type { FireEventListItemDto } from '@/modules/fires/types/fire.dto'
import { mapFireEventToEnvironmentalEvent } from '@/modules/environmental-events/thermal/thermal-event.mapper'
import { toFireEventsQuery } from '@/modules/environmental-events/thermal/thermal-query.mapper'
import { thermalMapRenderer } from '@/modules/environmental-events/thermal/thermal-map-renderer'
import {
  aggregateThermalEvents,
  buildThermalReportSection,
} from '@/modules/environmental-events/reports/thermal-report-section'
import { buildThermalEventDisplayName } from '@/modules/fires/utils/thermal-event-display'

const STABLE_SAMPLE: FireEventListItemDto[] = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    department_code: 'GT01',
    department_name: 'Petén',
    status: 'active',
    validation_status: 'confirmado',
    risk_level: 'alto',
    priority_score: 88,
    centroid_lat: 16.5,
    centroid_lng: -89.7,
    first_detected_at: '2026-07-09T06:00:00.000Z',
    last_detected_at: '2026-07-09T20:00:00.000Z',
    persistence_hours: 14,
    detection_count: 12,
    satellite_count: 3,
    source_products: ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'MODIS_NRT'],
    max_frp_mw: 120.4,
    geometry_method: 'convex_hull_buffer',
    cross_department: false,
    created_at: '2026-07-09T06:05:00.000Z',
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    department_code: 'GT17',
    department_name: 'Izabal',
    status: 'monitoring',
    validation_status: 'no_validado',
    risk_level: 'observacion',
    priority_score: 41,
    centroid_lat: 15.6,
    centroid_lng: -88.9,
    first_detected_at: '2026-07-10T02:00:00.000Z',
    last_detected_at: '2026-07-10T03:00:00.000Z',
    persistence_hours: 1,
    detection_count: 1,
    satellite_count: 1,
    source_products: ['MODIS_NRT'],
    max_frp_mw: null,
    geometry_method: 'single_detection_buffer',
    cross_department: false,
    created_at: '2026-07-10T02:05:00.000Z',
  },
]

describe('parity — canonical event vs source thermal DTO', () => {
  for (const src of STABLE_SAMPLE) {
    it(`preserves identity, geometry, dates and evidence for ${src.id}`, () => {
      const event = mapFireEventToEnvironmentalEvent(src)
      expect(event.id).toBe(src.id)
      expect(event.geometry).toEqual({
        type: 'Point',
        coordinates: [src.centroid_lng, src.centroid_lat],
      })
      expect(event.firstObservedAt).toBe(src.first_detected_at)
      expect(event.lastObservedAt).toBe(src.last_detected_at)
      expect(event.attributes.detectionCount).toBe(src.detection_count)
      expect(event.attributes.satelliteCount).toBe(src.satellite_count)
      expect(event.attributes.maxFrp).toBe(src.max_frp_mw ?? undefined)
      expect(event.persistence).toBe(src.persistence_hours ?? undefined)
      // Display name parity with the existing thermal helper.
      expect(event.title).toBe(buildThermalEventDisplayName(src))
    })
  }
})

describe('parity — query mapping', () => {
  it('translates canonical query into thermal query with paging semantics', () => {
    const q = toFireEventsQuery({ type: 'thermal_activity', status: 'resolved', page: 3, limit: 10 })
    expect(q.status).toBe('closed')
    expect(q.limit).toBe(10)
    expect(q.offset).toBe(20)
  })

  it('defaults page/limit safely', () => {
    const q = toFireEventsQuery({})
    expect(q.limit).toBe(25)
    expect(q.offset).toBe(0)
  })

  it('maps the dashboard map window query (since, no status) so it matches the KPI set', () => {
    // The map / auto-selection / territorial probes all use this exact shape.
    // It must NOT force a fire `status` (that narrowed the set to 0 vs the 48h
    // window count) and it must forward `since` onto `last_detected_at` — the
    // very column getFireSummary counts, guaranteeing summary/list parity.
    const since = '2026-07-08T00:00:00.000Z'
    const q = toFireEventsQuery({ type: 'thermal_activity', since, limit: 100 })
    expect(q.status).toBeUndefined()
    expect(q.since).toBe(since)
    expect(q.limit).toBe(100)
    expect(q.offset).toBe(0)
  })
})

describe('parity — thermal map feature (toMapFeature)', () => {
  it('produces a Point Feature with [lng, lat] and a stable id in properties', () => {
    const event = mapFireEventToEnvironmentalEvent(STABLE_SAMPLE[0])
    const feature = thermalMapRenderer.toMapFeature(event)
    expect(feature.type).toBe('Feature')
    expect(feature.geometry).toEqual({
      type: 'Point',
      coordinates: [STABLE_SAMPLE[0].centroid_lng, STABLE_SAMPLE[0].centroid_lat],
    })
    // Every feature must carry an id (both as Feature.id and properties.event_id)
    // so selection/highlighting and click→detail work.
    expect(feature.id).toBe(STABLE_SAMPLE[0].id)
    expect(feature.properties?.event_id).toBe(STABLE_SAMPLE[0].id)
  })
})

describe('parity — report adapter numbers', () => {
  it('aggregates the same counts as summing the source DTOs', () => {
    const events = STABLE_SAMPLE.map(mapFireEventToEnvironmentalEvent)
    const agg = aggregateThermalEvents(events)
    const expectedDetections = STABLE_SAMPLE.reduce((a, e) => a + e.detection_count, 0)
    const expectedMaxFrp = Math.max(
      ...STABLE_SAMPLE.filter((e) => e.max_frp_mw != null).map((e) => e.max_frp_mw as number),
    )
    expect(agg.eventCount).toBe(STABLE_SAMPLE.length)
    expect(agg.detectionCount).toBe(expectedDetections)
    expect(agg.maxFrp).toBe(expectedMaxFrp)
    expect(agg.limitations[0]).toContain('detección térmica')
  })

  it('builds a Spanish report section with same title and available status', () => {
    const events = STABLE_SAMPLE.map(mapFireEventToEnvironmentalEvent)
    const section = buildThermalReportSection(events)
    expect(section.title).toBe('Actividad térmica')
    expect(section.status).toBe('available')
    expect(section.content).toContain('eventos térmicos agrupados')
  })
})
