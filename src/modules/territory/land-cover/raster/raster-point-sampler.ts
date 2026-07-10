import type { GeoPoint, LandCoverPointSample } from '@/modules/territory/land-cover/land-cover.types'
import { runCommand } from '@/modules/territory/land-cover/processing/gdal'
import { mapEsaWorldCoverCode } from '@/modules/territory/land-cover/providers/esa-worldcover/esa-worldcover.mapper'

const OUTSIDE_COVERAGE = new Set(['-999999', '256'])

export async function samplePointFromRaster(
  rasterPath: string,
  point: GeoPoint,
): Promise<LandCoverPointSample> {
  const res = await runCommand('gdallocationinfo', [
    '-wgs84',
    '-valonly',
    rasterPath,
    String(point.lon),
    String(point.lat),
  ])

  const raw = res.stdout.trim().split('\n')[0]?.trim() ?? ''
  const outsideCoverage =
    res.exitCode !== 0 || raw === '' || OUTSIDE_COVERAGE.has(raw)
  const code = outsideCoverage ? null : Number(raw)
  const nodata = outsideCoverage || code === 0 || !Number.isFinite(code)
  const mapped = code != null && !nodata ? mapEsaWorldCoverCode(code) : null

  return {
    latitude: point.lat,
    longitude: point.lon,
    pointId: point.id,
    providerClassCode: mapped?.code ?? null,
    providerClassName: mapped?.provider_name ?? null,
    internalClass: mapped?.internal_class ?? 'unknown',
    nodata,
    outsideCoverage,
  }
}

export async function samplePointsFromRaster(
  rasterPath: string,
  points: GeoPoint[],
): Promise<LandCoverPointSample[]> {
  const results: LandCoverPointSample[] = []
  for (const point of points) {
    results.push(await samplePointFromRaster(rasterPath, point))
  }
  return results
}

export function pointSamplesToDistribution(
  samples: LandCoverPointSample[],
): {
  dominantClass: LandCoverPointSample['internalClass'] | null
  classDistribution: Array<{
    internalClass: LandCoverPointSample['internalClass']
    providerClassCode: number
    count: number
    pct: number
  }>
  validPixelCount: number
  nodataPixelCount: number
  dataCoveragePct: number
  analyzedAreaHa: number
} {
  const valid = samples.filter((s) => !s.nodata && s.providerClassCode != null)
  const counts = new Map<number, number>()
  for (const sample of valid) {
    const code = sample.providerClassCode!
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }
  const totalValid = valid.length
  const classDistribution = [...counts.entries()]
    .map(([code, count]) => {
      const mapped = mapEsaWorldCoverCode(code)
      return {
        internalClass: mapped.internal_class,
        providerClassCode: code,
        count,
        pct: totalValid > 0 ? (count / totalValid) * 100 : 0,
      }
    })
    .sort((a, b) => b.count - a.count)

  return {
    dominantClass: classDistribution[0]?.internalClass ?? null,
    classDistribution,
    validPixelCount: totalValid,
    nodataPixelCount: samples.length - totalValid,
    dataCoveragePct: samples.length > 0 ? (totalValid / samples.length) * 100 : 0,
    analyzedAreaHa: 0,
  }
}
