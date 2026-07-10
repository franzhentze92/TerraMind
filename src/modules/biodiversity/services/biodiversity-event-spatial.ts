import { haversineMeters } from '@/pipeline/engines/fire/event-scoring'

export type BiodiversityGeometrySource = 'detections_union' | 'event_centroid_fallback'

export interface BiodiversityAnalysisPoint {
  latitude: number
  longitude: number
  geometrySource: BiodiversityGeometrySource
  detectionCount: number
  maxSpreadM: number
}

export function computeDetectionsCentroid(
  detections: Array<{ latitude: number; longitude: number }>,
): { latitude: number; longitude: number } | null {
  if (!detections.length) return null
  let latSum = 0
  let lngSum = 0
  for (const d of detections) {
    latSum += d.latitude
    lngSum += d.longitude
  }
  return {
    latitude: latSum / detections.length,
    longitude: lngSum / detections.length,
  }
}

export function computeMaxSpreadM(
  centroid: { latitude: number; longitude: number },
  detections: Array<{ latitude: number; longitude: number }>,
): number {
  let max = 0
  for (const d of detections) {
    const dist = haversineMeters(
      centroid.latitude,
      centroid.longitude,
      d.latitude,
      d.longitude,
    )
    if (dist > max) max = dist
  }
  return max
}

export function resolveBiodiversityAnalysisPoint(input: {
  detections: Array<{ latitude: number; longitude: number }>
  centroidLat?: number | null
  centroidLng?: number | null
}): BiodiversityAnalysisPoint | null {
  if (input.detections.length > 0) {
    const centroid = computeDetectionsCentroid(input.detections)
    if (!centroid) return null
    return {
      latitude: centroid.latitude,
      longitude: centroid.longitude,
      geometrySource: 'detections_union',
      detectionCount: input.detections.length,
      maxSpreadM: computeMaxSpreadM(centroid, input.detections),
    }
  }

  if (input.centroidLat != null && input.centroidLng != null) {
    return {
      latitude: input.centroidLat,
      longitude: input.centroidLng,
      geometrySource: 'event_centroid_fallback',
      detectionCount: 0,
      maxSpreadM: 0,
    }
  }

  return null
}

export function distanceFromAnalysisPointM(
  point: { latitude: number; longitude: number },
  occurrenceLat: number,
  occurrenceLng: number,
): number {
  return haversineMeters(point.latitude, point.longitude, occurrenceLat, occurrenceLng)
}
