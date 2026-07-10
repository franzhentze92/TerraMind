import { describe, expect, it } from 'vitest'

import {
  centroidFallbackPoint,
  selectRepresentativeClimatePoints,
} from '@/modules/climate/services/climate-event-point-selection'

describe('climate-event-point-selection', () => {
  it('selects up to 3 representative points', () => {
    const detections = [
      { id: '1', lat: 14.0, lon: -90.0, acquired_at_utc: '2026-01-01T10:00:00Z' },
      { id: '2', lat: 14.1, lon: -90.1, acquired_at_utc: '2026-01-01T11:00:00Z' },
      { id: '3', lat: 14.2, lon: -90.2, acquired_at_utc: '2026-01-01T12:00:00Z' },
      { id: '4', lat: 14.05, lon: -90.05, acquired_at_utc: '2026-01-01T12:30:00Z' },
    ]
    const points = selectRepresentativeClimatePoints(detections, 3)
    expect(points).toHaveLength(3)
    expect(points.some((p) => p.role === 'first_detection')).toBe(true)
    expect(points.some((p) => p.role === 'last_detection')).toBe(true)
  })

  it('uses centroid fallback', () => {
    const point = centroidFallbackPoint(14.5, -91.0, '2026-01-01T00:00:00Z')
    expect(point.role).toBe('centroid_fallback')
  })
})
