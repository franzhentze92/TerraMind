/**
 * Pure geometry helpers for the national event map.
 *
 * Kept free of Leaflet/DOM so they can be unit-tested in node: they compute a
 * simple [[south, west], [north, east]] bounding box (lat/lng order, matching
 * Leaflet's `LatLngBoundsExpression`) from GeoJSON features whose positions are
 * `[lng, lat]`.
 */
export type LatLngBox = [[number, number], [number, number]]

function isPosition(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  )
}

/** A GeoJSON position [lng, lat] that is finite and not the null-island (0,0). */
function isUsablePosition(value: unknown): boolean {
  if (!isPosition(value)) return false
  const [lng, lat] = value
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false
  if (lng === 0 && lat === 0) return false
  // Reject clearly out-of-world coordinates (also catches lat/lng inversions
  // that push latitude beyond ±90).
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false
  return true
}

/**
 * True when a feature has at least one usable coordinate, so it can be drawn and
 * contribute to bounds. Filters out null geometry, (0,0), NaN and out-of-world
 * positions instead of silently rendering an invisible/misplaced marker.
 */
export function hasRenderableGeometry(feature: GeoJSON.Feature): boolean {
  const geometry = feature.geometry
  if (!geometry || !('coordinates' in geometry)) return false
  let usable = false
  const visit = (coords: unknown): void => {
    if (usable) return
    if (!Array.isArray(coords)) return
    if (isPosition(coords)) {
      if (isUsablePosition(coords)) usable = true
      return
    }
    for (const child of coords) visit(child)
  }
  visit((geometry as { coordinates: unknown }).coordinates)
  return usable
}

/** Bounding box of every coordinate in a FeatureCollection, or null if empty. */
export function boundsFromFeatureCollection(
  fc: GeoJSON.FeatureCollection,
): LatLngBox | null {
  let minLat = Infinity
  let minLng = Infinity
  let maxLat = -Infinity
  let maxLng = -Infinity
  let found = false

  const visit = (coords: unknown): void => {
    if (!Array.isArray(coords)) return
    if (isPosition(coords)) {
      if (isUsablePosition(coords)) {
        const [lng, lat] = coords
        found = true
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
      }
      return
    }
    for (const child of coords) visit(child)
  }

  for (const feature of fc.features) {
    const geometry = feature.geometry
    if (geometry && 'coordinates' in geometry) {
      visit((geometry as { coordinates: unknown }).coordinates)
    }
  }

  if (!found) return null
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ]
}

/** Union of several bounding boxes (null entries ignored), or null if none. */
export function combineBounds(boxes: Array<LatLngBox | null>): LatLngBox | null {
  let minLat = Infinity
  let minLng = Infinity
  let maxLat = -Infinity
  let maxLng = -Infinity
  let found = false

  for (const box of boxes) {
    if (!box) continue
    found = true
    const [[south, west], [north, east]] = box
    if (south < minLat) minLat = south
    if (west < minLng) minLng = west
    if (north > maxLat) maxLat = north
    if (east > maxLng) maxLng = east
  }

  if (!found) return null
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ]
}
