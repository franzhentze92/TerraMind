/**
 * Estadística zonal para población — diseño 7D.1.
 *
 * Método de área:
 * - Buffers métricos en LAEA-GT
 * - ST_UnaryUnion(ST_Collect(...)) para múltiples puntos
 * - Suma de píxeles intersectados (sin doble conteo en unión)
 * - Densidad = población / área_km2
 */

import type { GeoPoint, PopulationBufferResult } from '../population.types'

export interface ZonalPopulationInput {
  geometry: GeoJSON.Geometry
  geometryCrs: 'EPSG:4326' | 'LAEA-GT'
  radiiM?: number[]
  points?: GeoPoint[]
}

export interface ZonalPopulationResult {
  estimatedPopulation: number
  analyzedAreaHa: number
  densityPerKm2: number
  dataCoveragePct: number
  nodataPixelCount: number
  buffers?: PopulationBufferResult[]
}

/** SQL equivalente documentado para PostGIS (futuro o QA). */
export const BUFFER_UNION_SQL = `
SELECT ST_UnaryUnion(
  ST_Collect(
    ST_Buffer(point::geography, :radius_m)::geometry
  )
) AS unified_geometry
FROM unnest(:points::geometry[]) AS point
`.trim()

export function computeDensityPerKm2(population: number, areaHa: number): number {
  if (areaHa <= 0) return 0
  const areaKm2 = areaHa / 100
  return Math.round((population / areaKm2) * 100) / 100
}

export function computeDataCoveragePct(
  validPixelCount: number,
  nodataPixelCount: number,
): number {
  const total = validPixelCount + nodataPixelCount
  if (total === 0) return 0
  return Math.round((validPixelCount / total) * 1000) / 10
}

/**
 * Stub — cálculo real requiere raster montado (7D.1B).
 */
export async function analyzeZonalPopulation(
  _input: ZonalPopulationInput,
): Promise<ZonalPopulationResult> {
  return {
    estimatedPopulation: 0,
    analyzedAreaHa: 0,
    densityPerKm2: 0,
    dataCoveragePct: 0,
    nodataPixelCount: 0,
  }
}
