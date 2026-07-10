import { describe, expect, it } from 'vitest'

import { aggregateEventConditions } from '@/modules/climate/services/climate-event-aggregation'

describe('climate-event-aggregation', () => {
  it('aggregates multi-point without summing precipitation spatially', () => {
    const agg = aggregateEventConditions([
      {
        matchedTimestamp: '2026-01-01T10:00:00Z',
        temperature_c: 30,
        relative_humidity_pct: 40,
        wind_speed_kmh: 12,
        wind_gust_kmh: 20,
        wind_direction_deg: 225,
        precipitation_mm: 0.5,
        cloud_cover_pct: 10,
      },
      {
        matchedTimestamp: '2026-01-01T10:00:00Z',
        temperature_c: 28,
        relative_humidity_pct: 50,
        wind_speed_kmh: 8,
        wind_gust_kmh: 15,
        wind_direction_deg: 225,
        precipitation_mm: 1.2,
        cloud_cover_pct: 30,
      },
    ])

    expect(agg.temperature_c.mean).toBe(29)
    expect(agg.precipitation_mm.max).toBe(1.2)
    expect(agg.precipitation_mm.mean).toBe(0.9)
    expect(agg.wind_direction.cardinal).toBe('SW')
    expect(agg.wind_direction.toward_cardinal).toBe('NE')
  })
})
