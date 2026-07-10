import { describe, expect, it } from 'vitest'

import {
  computeDetectionsCentroid,
  resolveBiodiversityAnalysisPoint,
} from './biodiversity-event-spatial'

describe('biodiversity-event-spatial', () => {
  it('computes centroid from multiple detections', () => {
    const centroid = computeDetectionsCentroid([
      { latitude: 14, longitude: -90 },
      { latitude: 16, longitude: -92 },
    ])
    expect(centroid?.latitude).toBe(15)
    expect(centroid?.longitude).toBe(-91)
  })

  it('uses detections_union when detections exist', () => {
    const point = resolveBiodiversityAnalysisPoint({
      detections: [{ latitude: 14.5, longitude: -90.5 }],
      centroidLat: 10,
      centroidLng: -85,
    })
    expect(point?.geometrySource).toBe('detections_union')
    expect(point?.detectionCount).toBe(1)
  })

  it('falls back to event centroid when no detections', () => {
    const point = resolveBiodiversityAnalysisPoint({
      detections: [],
      centroidLat: 14.5,
      centroidLng: -90.5,
    })
    expect(point?.geometrySource).toBe('event_centroid_fallback')
  })
})
