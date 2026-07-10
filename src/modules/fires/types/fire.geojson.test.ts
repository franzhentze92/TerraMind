import { describe, expect, it } from 'vitest'
import { FIRE_SENSITIVE_FIELDS } from './fire.dto'
import type {
  FireDetectionGeoJsonProperties,
  FireEventGeoJsonProperties,
} from './fire.dto'

const EVENT_ALLOWED: (keyof FireEventGeoJsonProperties)[] = [
  'event_id',
  'department_code',
  'department_name',
  'status',
  'validation_status',
  'risk_level',
  'priority_score',
  'detection_count',
  'satellite_count',
  'last_detected_at',
  'geometry_method',
  'geometry_is_diagnostic',
]

const DETECTION_ALLOWED: (keyof FireDetectionGeoJsonProperties)[] = [
  'detection_id',
  'event_id',
  'acquired_at_utc',
  'source_product',
  'source_display_name',
  'satellite',
  'confidence_normalized',
  'frp_mw',
  'daynight',
]

function assertNoSensitiveKeys(obj: Record<string, unknown>) {
  for (const key of FIRE_SENSITIVE_FIELDS) {
    expect(obj).not.toHaveProperty(key)
  }
}

describe('GeoJSON DTO safety', () => {
  it('defines allowed event properties without sensitive fields', () => {
    const sample: FireEventGeoJsonProperties = {
      event_id: 'abc',
      department_code: '11',
      department_name: 'Retalhuleu',
      status: 'active',
      validation_status: 'probable',
      risk_level: 'atencion',
      priority_score: 54,
      detection_count: 3,
      satellite_count: 2,
      last_detected_at: '2026-07-09T12:00:00.000Z',
      geometry_method: 'convex_hull_buffer',
      geometry_is_diagnostic: true,
    }
    expect(Object.keys(sample).sort()).toEqual([...EVENT_ALLOWED].sort())
    assertNoSensitiveKeys(sample as unknown as Record<string, unknown>)
    expect(sample).not.toHaveProperty('estimated_area_ha')
  })

  it('defines allowed detection properties without sensitive fields', () => {
    const sample: FireDetectionGeoJsonProperties = {
      detection_id: 'det-1',
      event_id: 'abc',
      acquired_at_utc: '2026-07-09T12:00:00.000Z',
      source_product: 'VIIRS_SNPP_NRT',
      source_display_name: 'VIIRS S-NPP',
      satellite: 'N',
      confidence_normalized: 'alta',
      frp_mw: 12.5,
      daynight: 'D',
    }
    expect(Object.keys(sample).sort()).toEqual([...DETECTION_ALLOWED].sort())
    assertNoSensitiveKeys(sample as unknown as Record<string, unknown>)
    expect(sample).not.toHaveProperty('raw_payload')
    expect(sample).not.toHaveProperty('dedup_key')
  })

  it('validates FeatureCollection shape', () => {
    const fc = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          id: 'evt-1',
          geometry: { type: 'MultiPolygon' as const, coordinates: [] },
          properties: {
            event_id: 'evt-1',
            department_code: null,
            department_name: null,
            status: 'active',
            validation_status: 'no_validado',
            risk_level: 'informativo',
            priority_score: 10,
            detection_count: 1,
            satellite_count: 1,
            last_detected_at: '2026-07-09T12:00:00.000Z',
            geometry_method: 'convex_hull_buffer',
            geometry_is_diagnostic: true,
          },
        },
      ],
      generated_at: '2026-07-10T00:00:00.000Z',
    }
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features[0].geometry.type).toBe('MultiPolygon')
    assertNoSensitiveKeys(fc.features[0].properties)
  })
})
