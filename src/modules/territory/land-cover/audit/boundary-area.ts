import { readFileSync } from 'node:fs'
import {
  GUATEMALA_ADM0_GEOJSON,
  GUATEMALA_BOUNDARY_AREA_SQKM_PROPERTY,
} from '@/modules/territory/land-cover/processing/paths'

const D2R = Math.PI / 180
const EARTH_RADIUS_M = 6378137

function ringGeodesicAreaM2(ring: number[][]): number {
  let area = 0
  if (ring.length < 4) return 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i]
    const [lon2, lat2] = ring[i + 1]
    area +=
      (lon2 - lon1) * D2R *
      (2 + Math.sin(lat1 * D2R) + Math.sin(lat2 * D2R))
  }
  return Math.abs((area * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2)
}

export function computeGeodesicAreaSqkm(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
): number {
  if (geometry.type === 'Polygon') {
    let area = ringGeodesicAreaM2(geometry.coordinates[0])
    for (let i = 1; i < geometry.coordinates.length; i++) {
      area -= ringGeodesicAreaM2(geometry.coordinates[i])
    }
    return area / 1_000_000
  }
  return (
    geometry.coordinates.reduce((sum, poly) => {
      let area = ringGeodesicAreaM2(poly[0])
      for (let i = 1; i < poly.length; i++) area -= ringGeodesicAreaM2(poly[i])
      return sum + area
    }, 0) / 1_000_000
  )
}

export function readAdm0Geometry(): GeoJSON.Polygon | GeoJSON.MultiPolygon {
  const fc = JSON.parse(readFileSync(GUATEMALA_ADM0_GEOJSON, 'utf8')) as GeoJSON.FeatureCollection
  const geometry = fc.features[0]?.geometry
  if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) {
    throw new Error('ADM0 inválido')
  }
  return geometry
}

export function readHdxAreaSqkmProperty(): number | null {
  const fc = JSON.parse(readFileSync(GUATEMALA_ADM0_GEOJSON, 'utf8')) as GeoJSON.FeatureCollection
  const value = fc.features[0]?.properties?.[GUATEMALA_BOUNDARY_AREA_SQKM_PROPERTY]
  return typeof value === 'number' ? value : null
}

/** Referencia operativa TerraMind: LAEA planar del boundary versionado. */
export function readBoundaryReferenceAreaSqkm(method: 'laea' | 'geodesic' | 'hdx' = 'laea'): number {
  if (method === 'hdx') {
    return readHdxAreaSqkmProperty() ?? computeGeodesicAreaSqkm(readAdm0Geometry())
  }
  if (method === 'geodesic') {
    return computeGeodesicAreaSqkm(readAdm0Geometry())
  }
  // Valor medido en auditoría 7A.2-C con ogr ST_Area sobre ADM0 reproyectado a LAEA.
  return 108_238.9
}
