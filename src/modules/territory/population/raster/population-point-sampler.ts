import type { GeoPoint } from '@/modules/territory/population/population.types'
import { runCommand } from '@/modules/territory/population/processing/gdal'

const OUTSIDE_VALUES = new Set(['-999999', '-9999', 'nan', ''])

export interface PopulationPointSampleResult {
  latitude: number
  longitude: number
  pointId?: string
  populationCellEstimate: number
  estimateRounded: number
  nodata: boolean
  outsideCoverage: boolean
}

export async function samplePopulationCell(
  rasterPath: string,
  point: GeoPoint,
): Promise<PopulationPointSampleResult> {
  const res = await runCommand('gdallocationinfo', [
    '-wgs84',
    '-valonly',
    rasterPath,
    String(point.lon),
    String(point.lat),
  ])

  const raw = res.stdout.trim().split('\n')[0]?.trim() ?? ''
  const outsideCoverage =
    res.exitCode !== 0 || raw === '' || OUTSIDE_VALUES.has(raw.toLowerCase())
  const value = outsideCoverage ? 0 : Number(raw)
  const nodata =
    outsideCoverage || !Number.isFinite(value) || value < 0 || Math.abs(value + 9999) < 1e-3

  const populationCellEstimate = nodata ? 0 : value

  return {
    latitude: point.lat,
    longitude: point.lon,
    pointId: point.id,
    populationCellEstimate,
    estimateRounded: Math.round(populationCellEstimate),
    nodata,
    outsideCoverage,
  }
}
