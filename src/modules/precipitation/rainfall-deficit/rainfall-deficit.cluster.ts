/**
 * Rainfall deficit — spatial clustering of candidate CHIRPS cells.
 */
import type { ChirpsGridCell } from '@/modules/precipitation/chirps-v3/chirps-grid.types'
import { cellAreaKm2, cellToPolygon } from '@/modules/precipitation/chirps-v3/chirps-grid.types'
import { CHIRPS_V3_GRID_RESOLUTION_DEG } from '@/modules/precipitation/chirps-v3/chirps-v3.config'
import { CLUSTER_MIN_AREA_KM2, CLUSTER_MIN_CELLS } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.config'

export interface RainfallDeficitCluster {
  id: string
  cells: ChirpsGridCell[]
  cellCount: number
  areaKm2: number
  centroidLat: number
  centroidLon: number
  geometry: GeoJSON.MultiPolygon
}

function cellKey(c: ChirpsGridCell): string {
  return `${c.row},${c.col}`
}

/** 4-neighbor connected components. */
export function clusterCandidateCells(candidates: ChirpsGridCell[]): RainfallDeficitCluster[] {
  const byKey = new Map(candidates.map((c) => [cellKey(c), c]))
  const visited = new Set<string>()
  const clusters: RainfallDeficitCluster[] = []

  for (const start of candidates) {
    const sk = cellKey(start)
    if (visited.has(sk)) continue
    const queue = [start]
    const component: ChirpsGridCell[] = []
    visited.add(sk)

    while (queue.length) {
      const cur = queue.shift()!
      component.push(cur)
      const neighbors = [
        `${cur.row - 1},${cur.col}`,
        `${cur.row + 1},${cur.col}`,
        `${cur.row},${cur.col - 1}`,
        `${cur.row},${cur.col + 1}`,
      ]
      for (const nk of neighbors) {
        if (visited.has(nk) || !byKey.has(nk)) continue
        visited.add(nk)
        queue.push(byKey.get(nk)!)
      }
    }

    const areaKm2 = component.reduce(
      (sum, c) => sum + cellAreaKm2(CHIRPS_V3_GRID_RESOLUTION_DEG, c.lat),
      0,
    )
    if (component.length < CLUSTER_MIN_CELLS || areaKm2 < CLUSTER_MIN_AREA_KM2) continue

    const centroidLat = component.reduce((s, c) => s + c.lat, 0) / component.length
    const centroidLon = component.reduce((s, c) => s + c.lon, 0) / component.length
    const polygons = component.map((c) => cellToPolygon(c, CHIRPS_V3_GRID_RESOLUTION_DEG).coordinates)

    clusters.push({
      id: `cluster_${clusters.length + 1}`,
      cells: component,
      cellCount: component.length,
      areaKm2,
      centroidLat,
      centroidLon,
      geometry: { type: 'MultiPolygon', coordinates: polygons },
    })
  }
  return clusters
}
