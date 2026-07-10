import type { InternalLandCoverClass } from '@/modules/territory/land-cover/land-cover.types'
import { mapEsaWorldCoverCode } from '@/modules/territory/land-cover/providers/esa-worldcover/esa-worldcover.mapper'
import {
  classPercentages,
  parseGdalInfoJson,
  type RasterBandSummary,
} from '@/modules/territory/land-cover/processing/raster-stats'

export interface HistogramDistribution {
  histogram: Record<number, number>
  validPixelCount: number
  nodataPixelCount: number
  pixelAreaM2: number
}

export function histogramFromSummary(summary: RasterBandSummary): HistogramDistribution {
  const pixelW = summary.pixel_size?.[0] ?? 10
  const pixelH = summary.pixel_size?.[1] ?? 10
  const histogram: Record<number, number> = {}
  for (const [code, count] of Object.entries(summary.class_histogram)) {
    histogram[Number(code)] = count
  }
  return {
    histogram,
    validPixelCount: summary.valid_pixel_count,
    nodataPixelCount: summary.nodata_pixel_count,
    pixelAreaM2: pixelW * pixelH,
  }
}

export function distributionFromHistogram(
  data: HistogramDistribution,
): {
  dominantClass: InternalLandCoverClass | null
  classDistribution: Array<{
    internalClass: InternalLandCoverClass
    providerClassCode: number
    count: number
    pct: number
  }>
  validPixelCount: number
  nodataPixelCount: number
  dataCoveragePct: number
  analyzedAreaHa: number
} {
  const summary: RasterBandSummary = {
    path: '',
    crs: null,
    size: { width: 0, height: 0 },
    pixel_size: [Math.sqrt(data.pixelAreaM2), Math.sqrt(data.pixelAreaM2)],
    nodata: 0,
    data_type: 'Byte',
    bounds: null,
    class_histogram: Object.fromEntries(
      Object.entries(data.histogram).map(([k, v]) => [k, v]),
    ),
    valid_pixel_count: data.validPixelCount,
    nodata_pixel_count: data.nodataPixelCount,
    unknown_class_codes: [],
  }

  const rows = classPercentages(summary, data.pixelAreaM2)
  const classDistribution = rows.map((row) => {
    const mapped = mapEsaWorldCoverCode(row.code)
    return {
      internalClass: mapped.internal_class,
      providerClassCode: row.code,
      count: row.count,
      pct: row.pct,
    }
  })

  const total = data.validPixelCount + data.nodataPixelCount
  const dominant = classDistribution[0]?.internalClass ?? null

  return {
    dominantClass: dominant,
    classDistribution,
    validPixelCount: data.validPixelCount,
    nodataPixelCount: data.nodataPixelCount,
    dataCoveragePct: total > 0 ? (data.validPixelCount / total) * 100 : 0,
    analyzedAreaHa: (data.validPixelCount * data.pixelAreaM2) / 10_000,
  }
}

export function distributionFromGdalSummary(summary: RasterBandSummary) {
  return distributionFromHistogram(histogramFromSummary(summary))
}

export function distributionFromGdalJson(path: string, json: Record<string, unknown>) {
  return distributionFromGdalSummary(parseGdalInfoJson(path, json))
}
