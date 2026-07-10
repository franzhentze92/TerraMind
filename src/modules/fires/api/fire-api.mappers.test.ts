import { describe, expect, it } from 'vitest'
import { mapEventRowToDto, stripSensitiveFields } from '@/modules/fires/api/fire-api.mappers'
import { FIRE_SENSITIVE_FIELDS } from '@/modules/fires/types/fire.dto'

const baseRow = {
  id: '5b2ef52f-0000-4000-8000-000000000001',
  status: 'active',
  validation_status: 'probable',
  risk_level: 'atencion',
  priority_score: 54,
  centroid_lat: 14.2,
  centroid_lng: -91.7,
  first_detected_at: '2026-07-09T19:51:00.000Z',
  last_detected_at: '2026-07-09T20:12:00.000Z',
  persistence_hours: 0.35,
  detection_count: 3,
  satellite_count: 2,
  source_products: ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT'],
  max_frp_mw: 10.65,
  geometry_method: 'convex_hull_buffer',
  created_at: '2026-07-10T00:00:00.000Z',
  metadata: { cross_department: false, cluster_model_version: 'v1' },
  geo_departments: { code: 'RE', name: 'Retalhuleu' },
}

describe('mapEventRowToDto', () => {
  it('maps safe public fields', () => {
    const dto = mapEventRowToDto(baseRow)
    expect(dto.id).toBe(baseRow.id)
    expect(dto.department_name).toBe('Retalhuleu')
    expect(dto.department_code).toBe('RE')
    expect(dto.cross_department).toBe(false)
    expect(dto.priority_score).toBe(54)
  })

  it('does not expose metadata or geometry fields', () => {
    const dto = mapEventRowToDto(baseRow)
    expect(dto).not.toHaveProperty('metadata')
    expect(dto).not.toHaveProperty('event_geometry')
    expect(dto).not.toHaveProperty('estimated_area_ha')
    expect(dto).not.toHaveProperty('raw_payload')
  })

  it('reads cross_department from metadata only', () => {
    const dto = mapEventRowToDto({
      ...baseRow,
      metadata: { cross_department: true },
    })
    expect(dto.cross_department).toBe(true)
  })
})

describe('stripSensitiveFields', () => {
  it('removes prohibited keys', () => {
    const raw = {
      id: 'x',
      metadata: { secret: true },
      raw_payload: { x: 1 },
      estimated_area_ha: 114.77,
    }
    const safe = stripSensitiveFields(raw)
    for (const key of FIRE_SENSITIVE_FIELDS) {
      expect(safe).not.toHaveProperty(key)
    }
    expect(safe.id).toBe('x')
  })
})

describe('event ordering', () => {
  it('sorts by priority_score desc then last_detected_at desc', () => {
    const rows = [
      mapEventRowToDto({ ...baseRow, id: 'a', priority_score: 42, last_detected_at: '2026-07-09T20:00:00.000Z' }),
      mapEventRowToDto({ ...baseRow, id: 'b', priority_score: 54, last_detected_at: '2026-07-09T19:00:00.000Z' }),
      mapEventRowToDto({ ...baseRow, id: 'c', priority_score: 54, last_detected_at: '2026-07-09T21:00:00.000Z' }),
    ]
    const sorted = [...rows].sort((a, b) => {
      if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score
      return b.last_detected_at.localeCompare(a.last_detected_at)
    })
    expect(sorted.map((r) => r.id)).toEqual(['c', 'b', 'a'])
  })
})
