import type { SettlementRecord } from '@/modules/territory/population/admin/population-admin.types'
import { loadSettlementsFromDisk } from '@/modules/territory/population/providers/ine/ine-import-builder'
import type { NearestSettlement } from '@/modules/territory/population/population.types'
import { INE_SOURCE_CODE } from '@/modules/territory/population/providers/ine/ine.manifest'

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function geometryCentroid(geometry: GeoJSON.Geometry): { lat: number; lon: number } | null {
  if (geometry.type === 'Point') {
    return { lon: geometry.coordinates[0]!, lat: geometry.coordinates[1]! }
  }
  if (geometry.type === 'Polygon' && geometry.coordinates[0]?.[0]) {
    const ring = geometry.coordinates[0]
    const lon = ring.reduce((s, c) => s + c[0]!, 0) / ring.length
    const lat = ring.reduce((s, c) => s + c[1]!, 0) / ring.length
    return { lat, lon }
  }
  return null
}

export function findNearestSettlements(input: {
  geometry: GeoJSON.Geometry
  limit?: number
  maxDistanceM?: number
  settlements?: SettlementRecord[]
}): NearestSettlement[] {
  const centroid = geometryCentroid(input.geometry)
  if (!centroid) return []

  const settlements = input.settlements ?? loadSettlementsFromDisk()
  const limit = input.limit ?? 5
  const maxDistanceM = input.maxDistanceM ?? 50_000

  const ranked = settlements
    .map((s) => ({
      settlement: s,
      distanceM: haversineM(centroid.lat, centroid.lon, s.lat, s.lon),
    }))
    .filter((r) => r.distanceM <= maxDistanceM)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit)

  return ranked.map(({ settlement, distanceM }) => ({
    name: settlement.name,
    settlementType: settlement.settlementType,
    municipalityCode: settlement.municipalityCode,
    municipalityName: settlement.municipalityName,
    departmentCode: settlement.departmentCode,
    departmentName: settlement.departmentName,
    distanceM: Math.round(distanceM),
    populationReported: settlement.populationReference,
    source: settlement.source === 'hdx_cod_ab_complement' ? 'hdx_cod_ab' : INE_SOURCE_CODE,
    referenceYear: settlement.populationReferenceYear,
  }))
}

export function findNearestSettlementsAtPoint(
  lat: number,
  lon: number,
  limit = 5,
): NearestSettlement[] {
  return findNearestSettlements({
    geometry: { type: 'Point', coordinates: [lon, lat] },
    limit,
  })
}
