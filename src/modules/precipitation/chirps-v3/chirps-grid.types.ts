/**
 * CHIRPS v3 — grid cell model (0.05° regional grid clipped to Guatemala).
 */
export interface ChirpsGridCell {
  row: number
  col: number
  lat: number
  lon: number
  precipitationMm: number
  isNoData: boolean
}

export interface ChirpsGridSnapshot {
  cells: ChirpsGridCell[]
  rows: number
  cols: number
  originLat: number
  originLon: number
  resolutionDeg: number
  variant: 'preliminary' | 'final'
  pentadKey: string
  checksum?: string
  sourceUrl: string
}

/** Deterministic cell polygon (approximate CHIRPS cell). */
export function cellToPolygon(cell: ChirpsGridCell, resolutionDeg: number): GeoJSON.Polygon {
  const half = resolutionDeg / 2
  const west = cell.lon - half
  const east = cell.lon + half
  const south = cell.lat - half
  const north = cell.lat + half
  return {
    type: 'Polygon',
    coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
  }
}

export function cellAreaKm2(resolutionDeg: number, lat: number): number {
  const latKm = resolutionDeg * 111
  const lonKm = resolutionDeg * 111 * Math.cos((lat * Math.PI) / 180)
  return latKm * lonKm
}
