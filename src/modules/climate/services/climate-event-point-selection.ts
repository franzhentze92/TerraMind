export interface ClimateDetectionPoint {
  id?: string
  lat: number
  lon: number
  acquired_at_utc: string
}

export type ClimatePointRole =
  | 'first_detection'
  | 'last_detection'
  | 'spatial_extreme'
  | 'centroid_fallback'

export interface ClimateRepresentativePoint extends ClimateDetectionPoint {
  role: ClimatePointRole
}

function haversineM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6_371_000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function centroid(points: ClimateDetectionPoint[]): { lat: number; lon: number } {
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lon: acc.lon + p.lon }), {
    lat: 0,
    lon: 0,
  })
  return { lat: sum.lat / points.length, lon: sum.lon / points.length }
}

export function selectRepresentativeClimatePoints(
  detections: ClimateDetectionPoint[],
  maxPoints: number,
): ClimateRepresentativePoint[] {
  if (detections.length === 0) return []
  if (detections.length <= maxPoints) {
    const sorted = [...detections].sort((a, b) =>
      a.acquired_at_utc.localeCompare(b.acquired_at_utc),
    )
    return sorted.map((d, i) => ({
      ...d,
      role:
        i === 0
          ? 'first_detection'
          : i === sorted.length - 1
            ? 'last_detection'
            : 'spatial_extreme',
    }))
  }

  const sorted = [...detections].sort((a, b) =>
    a.acquired_at_utc.localeCompare(b.acquired_at_utc),
  )
  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  const center = centroid(detections)

  let extreme = sorted[Math.floor(sorted.length / 2)]!
  let maxDist = 0
  for (const d of sorted) {
    const dist = haversineM(d, center)
    if (dist > maxDist) {
      maxDist = dist
      extreme = d
    }
  }

  const chosen = new Map<string, ClimateRepresentativePoint>()
  const add = (point: ClimateDetectionPoint, role: ClimatePointRole) => {
    const key = `${point.lat.toFixed(5)}:${point.lon.toFixed(5)}:${point.acquired_at_utc}`
    if (!chosen.has(key)) chosen.set(key, { ...point, role })
  }

  add(first, 'first_detection')
  add(extreme, 'spatial_extreme')
  add(last, 'last_detection')

  return [...chosen.values()].slice(0, maxPoints)
}

export function centroidFallbackPoint(
  lat: number,
  lon: number,
  timestampUtc: string,
): ClimateRepresentativePoint {
  return {
    id: 'centroid',
    lat,
    lon,
    acquired_at_utc: timestampUtc,
    role: 'centroid_fallback',
  }
}
