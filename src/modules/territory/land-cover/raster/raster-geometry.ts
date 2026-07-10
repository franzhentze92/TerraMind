import { writeFileSync } from 'node:fs'
import type { GeoPoint } from '@/modules/territory/land-cover/land-cover.types'
import { runCommand } from '@/modules/territory/land-cover/processing/gdal'
import { LAEA_PROJ4 } from '@/modules/territory/land-cover/processing/paths'

function pointsFeatureCollection(points: GeoPoint[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map((p, index) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: { id: p.id ?? `p${index}` },
    })),
  }
}

export function writePointsGeoJson(path: string, points: GeoPoint[]): void {
  writeFileSync(path, `${JSON.stringify(pointsFeatureCollection(points))}\n`, 'utf8')
}

export async function reprojectGeoJsonToLaea(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  const res = await runCommand('ogr2ogr', [
    '-overwrite',
    '-t_srs',
    LAEA_PROJ4,
    outputPath,
    inputPath,
  ])
  if (res.exitCode !== 0) {
    throw new Error(`ogr2ogr reproyección LAEA falló: ${res.stderr || res.stdout}`)
  }
}

export async function getGeoJsonLayerName(path: string): Promise<string> {
  const res = await runCommand('ogrinfo', [path])
  if (res.exitCode !== 0) {
    throw new Error(`ogrinfo falló: ${res.stderr || res.stdout}`)
  }
  const match = res.stdout.match(/^\d+:\s+(\S+)/m)
  if (!match?.[1]) throw new Error(`Capa no encontrada en ${path}`)
  return match[1]
}

export async function buildMetricBufferUnionGeoJson(input: {
  points: GeoPoint[]
  radiusM: number
  pointsWgs84Path: string
  pointsLaeaPath: string
  unionPath: string
  unify: boolean
}): Promise<void> {
  writePointsGeoJson(input.pointsWgs84Path, input.points)
  await reprojectGeoJsonToLaea(input.pointsWgs84Path, input.pointsLaeaPath)
  const layer = await getGeoJsonLayerName(input.pointsLaeaPath)
  const sql = input.unify
    ? `SELECT ST_Union(ST_Buffer(geometry, ${input.radiusM})) AS geometry FROM "${layer}"`
    : `SELECT ST_Buffer(geometry, ${input.radiusM}) AS geometry FROM "${layer}"`
  const res = await runCommand('ogr2ogr', [
    '-overwrite',
    '-f',
    'GeoJSON',
    input.unionPath,
    input.pointsLaeaPath,
    '-dialect',
    'SQLite',
    '-sql',
    sql,
  ])
  if (res.exitCode !== 0) {
    throw new Error(`ogr2ogr buffer/unión falló: ${res.stderr || res.stdout}`)
  }
}

export async function reprojectGeometryToLaea(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  workspacePath: string,
): Promise<string> {
  const wgsPath = `${workspacePath}/geometry_wgs84.geojson`
  const laeaPath = `${workspacePath}/geometry_laea.geojson`
  writeFileSync(
    wgsPath,
    `${JSON.stringify({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry, properties: {} }],
    })}\n`,
    'utf8',
  )
  await reprojectGeoJsonToLaea(wgsPath, laeaPath)
  return laeaPath
}

export function isValidAnalysisGeometry(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
): boolean {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.length > 0 && geometry.coordinates[0].length >= 4
  }
  return geometry.coordinates.some((poly) => poly[0]?.length >= 4)
}
