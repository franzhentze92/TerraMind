/**
 * Rainfall deficit — municipal (ADM2) aggregation.
 *
 * Assigns CHIRPS grid cells to Guatemalan municipalities (HDX COD-AB ADM2) and
 * aggregates precipitation with area weighting (cos-latitude cell area). Municipal
 * percentiles are derived from municipal-level accumulated series — NEVER by
 * averaging per-cell percentiles.
 *
 * The ADM2 layer contains 342 geometries: 340 canonical municipalities plus 2
 * lake entities (Lago De Amatitlán GT0100, Lago De Atitlán GT0700). Lakes are
 * classified explicitly and excluded from municipal counts/aggregation, but their
 * geometry is preserved for spatial operations via `loadAdm2Entities()`.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const ADM2_GEOJSON_PATH = resolve(
  process.cwd(),
  'data/geo/sources/hdx-cod-ab-guatemala/2025-10-30-v01/extracted/gtm_admin2.geojson',
)

/** Canonical count of Guatemalan municipalities (excludes lake entities). */
export const GUATEMALA_MUNICIPALITY_COUNT = 340

/** ADM2 entity classification: only municipalities are counted as municipios. */
export type AdministrativeEntityType = 'municipality' | 'lake' | 'special_area'

/** pcodes of the 2 lake entities present in the ADM2 layer. */
export const ADM2_LAKE_PCODES = ['GT0100', 'GT0700'] as const

export interface Municipality {
  pcode: string
  name: string
  adm1Name: string
  adm1Pcode: string
  areaKm2: number
  centerLat: number
  centerLon: number
  /** Classified ADM2 entity type. Municipal aggregation uses `municipality` only. */
  entityType: AdministrativeEntityType
  /** MultiPolygon rings: polygons[ring][point] = [lon, lat]; ring 0 = outer. */
  polygons: number[][][][]
  bbox: [number, number, number, number]
}

/**
 * Classify an ADM2 entity. The HDX COD-AB Guatemala dataset encodes the 2 lake
 * bodies with a pcode ending in `00` and a name prefixed "Lago De". Everything
 * else is a municipality.
 */
export function classifyAdm2Entity(pcode: string, name: string): AdministrativeEntityType {
  if ((ADM2_LAKE_PCODES as readonly string[]).includes(pcode)) return 'lake'
  if (/^lago\b/i.test(name.trim())) return 'lake'
  return 'municipality'
}

interface GeoFeature {
  properties: Record<string, unknown>
  geometry: { type: string; coordinates: unknown }
}

function toPolygons(geometry: GeoFeature['geometry']): number[][][][] {
  if (geometry.type === 'Polygon') return [geometry.coordinates as number[][][]]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as number[][][][]
  return []
}

function bboxOf(polygons: number[][][][]): [number, number, number, number] {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  for (const poly of polygons) {
    for (const ring of poly) {
      for (const [lon, lat] of ring) {
        if (lon! < minLon) minLon = lon!
        if (lon! > maxLon) maxLon = lon!
        if (lat! < minLat) minLat = lat!
        if (lat! > maxLat) maxLat = lat!
      }
    }
  }
  return [minLon, minLat, maxLon, maxLat]
}

let cachedEntities: Municipality[] | null = null
let cachedMunicipalities: Municipality[] | null = null

/** All 342 ADM2 geometries, each classified (municipality | lake | special_area). */
export function loadAdm2Entities(force = false): Municipality[] {
  if (cachedEntities && !force) return cachedEntities
  const raw = JSON.parse(readFileSync(ADM2_GEOJSON_PATH, 'utf8')) as { features: GeoFeature[] }
  cachedEntities = raw.features.map((f) => {
    const p = f.properties
    const polygons = toPolygons(f.geometry)
    const pcode = String(p.adm2_pcode ?? '')
    const name = String(p.adm2_name ?? p.adm2_ref_name ?? '')
    return {
      pcode,
      name,
      adm1Name: String(p.adm1_name ?? ''),
      adm1Pcode: String(p.adm1_pcode ?? ''),
      areaKm2: Number(p.area_sqkm ?? 0),
      centerLat: Number(p.center_lat ?? 0),
      centerLon: Number(p.center_lon ?? 0),
      entityType: classifyAdm2Entity(pcode, name),
      polygons,
      bbox: bboxOf(polygons),
    }
  })
  return cachedEntities
}

/** Lake entities (2), preserved for spatial operations but never counted as municipios. */
export function loadAdm2Lakes(force = false): Municipality[] {
  return loadAdm2Entities(force).filter((e) => e.entityType === 'lake')
}

/**
 * The 340 canonical municipalities (lakes excluded). Used for municipal
 * aggregation and every public municipal count.
 */
export function loadMunicipalities(force = false): Municipality[] {
  if (cachedMunicipalities && !force) return cachedMunicipalities
  cachedMunicipalities = loadAdm2Entities(force).filter((e) => e.entityType === 'municipality')
  return cachedMunicipalities
}

/** Ray-casting point-in-ring (ring is a closed loop of [lon, lat]). */
function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!
    const yi = ring[i]![1]!
    const xj = ring[j]![0]!
    const yj = ring[j]![1]!
    const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** Point-in-polygon supporting holes (ring 0 outer, rest holes) + MultiPolygon. */
export function pointInMunicipality(lon: number, lat: number, m: Municipality): boolean {
  if (lon < m.bbox[0] || lon > m.bbox[2] || lat < m.bbox[1] || lat > m.bbox[3]) return false
  for (const poly of m.polygons) {
    if (poly.length === 0) continue
    if (!pointInRing(lon, lat, poly[0]!)) continue
    let inHole = false
    for (let h = 1; h < poly.length; h++) {
      if (pointInRing(lon, lat, poly[h]!)) {
        inHole = true
        break
      }
    }
    if (!inHole) return true
  }
  return false
}

export interface CellRef {
  index: number
  lat: number
  lon: number
}

export interface MunicipalAssignment {
  /** pcode → cell indices whose center falls in the municipality. */
  byMunicipality: Map<string, number[]>
  /** cell index → pcode (or undefined if outside all municipalities). */
  cellToMunicipality: (string | undefined)[]
  /** pcodes that received no cell center (too small / sliver) and used nearest-cell fallback. */
  lowCoveragePcodes: string[]
}

/** cos-latitude area weight for a cell (relative). */
export function cellAreaWeight(lat: number): number {
  return Math.cos((lat * Math.PI) / 180)
}

/**
 * Assign cells to municipalities by centroid. Municipalities receiving no cell
 * center fall back to their nearest cell (flagged low-coverage) so every
 * municipality is represented.
 */
export function assignCellsToMunicipalities(cells: CellRef[], municipalities: Municipality[]): MunicipalAssignment {
  const byMunicipality = new Map<string, number[]>()
  const cellToMunicipality: (string | undefined)[] = new Array(cells.length).fill(undefined)
  for (const m of municipalities) byMunicipality.set(m.pcode, [])

  for (const cell of cells) {
    for (const m of municipalities) {
      if (pointInMunicipality(cell.lon, cell.lat, m)) {
        byMunicipality.get(m.pcode)!.push(cell.index)
        cellToMunicipality[cell.index] = m.pcode
        break
      }
    }
  }

  const lowCoveragePcodes: string[] = []
  for (const m of municipalities) {
    if (byMunicipality.get(m.pcode)!.length > 0) continue
    let best: number | undefined
    let bestDist = Infinity
    for (const cell of cells) {
      const d = (cell.lat - m.centerLat) ** 2 + (cell.lon - m.centerLon) ** 2
      if (d < bestDist) {
        bestDist = d
        best = cell.index
      }
    }
    if (best !== undefined) {
      byMunicipality.get(m.pcode)!.push(best)
      lowCoveragePcodes.push(m.pcode)
    }
  }
  return { byMunicipality, cellToMunicipality, lowCoveragePcodes }
}

/** Area-weighted mean of per-cell values for a set of cells. */
export function areaWeightedMean(cellIndices: number[], values: number[], cellLats: number[]): number | undefined {
  let num = 0
  let den = 0
  for (const idx of cellIndices) {
    const v = values[idx]
    if (v === undefined || !Number.isFinite(v)) continue
    const w = cellAreaWeight(cellLats[idx]!)
    num += v * w
    den += w
  }
  return den > 0 ? num / den : undefined
}
