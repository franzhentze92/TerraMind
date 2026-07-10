import { gdalInfoJson } from '@/modules/territory/population/processing/gdal'

export interface PopulationRasterInspection {
  path: string
  driver: string | null
  crs: string | null
  pixelSize: [number, number] | null
  width: number
  height: number
  bounds: [number, number, number, number] | null
  dataType: string | null
  nodata: number | null
  minimum: number | null
  maximum: number | null
  mean: number | null
  negativePixelCount: number
  nonFinitePixelCount: number
  validPixelCount: number
  nodataPixelCount: number
  populationSum: number
  cellSemantics: 'persons_per_pixel'
  effectiveResolutionM: number | null
}

function parseCrs(json: Record<string, unknown>): string | null {
  const cs = json.coordinateSystem as
    | { wkt?: string; proj4?: string; authority?: { code?: string | number } }
    | undefined
  const gdalMetadata = (json.metadata as Record<string, Record<string, string>> | undefined)?.[''] ?? {}
  const epsgCode = cs?.authority?.code != null ? String(cs.authority.code) : ''
  const wkt = cs?.wkt ?? ''
  if (wkt.includes('Lambert Azimuthal Equal Area') || (cs?.proj4 ?? '').includes('laea')) {
    return 'LAEA-GT'
  }
  if (
    epsgCode === '4326' ||
    gdalMetadata.product_crs === 'EPSG:4326' ||
    (wkt.includes('GEOGCRS') && wkt.includes('WGS 84'))
  ) {
    return 'EPSG:4326'
  }
  return epsgCode ? `EPSG:${epsgCode}` : wkt.slice(0, 60) || null
}

function sumFromHistogram(hist: {
  buckets?: number[]
  min?: number
  max?: number
  count?: number
}): { sum: number; negative: number; nonFinite: number; valid: number; nodata: number } {
  const buckets = hist.buckets ?? []
  const min = hist.min ?? 0
  const max = hist.max ?? 0
  const totalCount = hist.count ?? buckets.reduce((a, b) => a + b, 0)
  if (buckets.length === 0) {
    return { sum: 0, negative: 0, nonFinite: 0, valid: 0, nodata: totalCount }
  }
  const bucketWidth = buckets.length > 1 ? (max - min) / buckets.length : max - min
  let sum = 0
  let negative = 0
  let valid = 0
  for (let i = 0; i < buckets.length; i++) {
    const count = buckets[i] ?? 0
    if (count === 0) continue
    const bucketMin = min + i * bucketWidth
    const bucketMax = bucketMin + bucketWidth
    const midpoint = (bucketMin + bucketMax) / 2
    sum += midpoint * count
    if (midpoint < 0) negative += count
    else if (midpoint > 0) valid += count
  }
  const nodata = Math.max(0, totalCount - valid - negative)
  return { sum, negative, nonFinite: 0, valid, nodata }
}

export function parsePopulationRasterInspection(
  path: string,
  json: Record<string, unknown>,
): PopulationRasterInspection {
  const sizeRaw = json.size as { x: number; y: number } | number[] | undefined
  let width = 0
  let height = 0
  if (Array.isArray(sizeRaw)) {
    width = sizeRaw[0] ?? 0
    height = sizeRaw[1] ?? 0
  } else if (sizeRaw) {
    width = sizeRaw.x ?? 0
    height = sizeRaw.y ?? 0
  }

  const geoTransform = json.geoTransform as number[] | undefined
  let pixelSize: [number, number] | null = null
  if (geoTransform && geoTransform.length >= 6) {
    pixelSize = [geoTransform[1], Math.abs(geoTransform[5])]
  }

  let bounds: [number, number, number, number] | null = null
  const corners = json.cornerCoordinates as Record<string, string[]> | undefined
  if (corners?.lowerLeft && corners?.upperRight) {
    bounds = [
      Number(corners.lowerLeft[0]),
      Number(corners.lowerLeft[1]),
      Number(corners.upperRight[0]),
      Number(corners.upperRight[1]),
    ]
  }

  const bands = (json.bands as Array<Record<string, unknown>>) ?? []
  const band1 = bands[0] ?? {}
  const bandMetadata = (band1.metadata as Record<string, Record<string, string>>) ?? {}
  const stats = bandMetadata[''] ?? {}
  const hist = (band1.histogram as {
    buckets?: number[]
    min?: number
    max?: number
    count?: number
  }) ?? { buckets: [] }

  const histAgg = sumFromHistogram(hist)
  const latMid = bounds ? (bounds[1] + bounds[3]) / 2 : 15.5
  const metersPerDegLon = 111_320 * Math.cos((latMid * Math.PI) / 180)
  const effectiveResolutionM =
    pixelSize && pixelSize[0] < 1
      ? Math.round(((pixelSize[0] * metersPerDegLon + pixelSize[1] * 111_320) / 2) * 10) / 10
      : pixelSize
        ? Math.round(((pixelSize[0] + pixelSize[1]) / 2) * 10) / 10
        : null

  return {
    path,
    driver: (json.driverShortName as string) ?? null,
    crs: parseCrs(json),
    pixelSize,
    width,
    height,
    bounds,
    dataType: (band1.type as string) ?? null,
    nodata: band1.noDataValue != null ? Number(band1.noDataValue) : null,
    minimum: stats.STATISTICS_MINIMUM != null ? Number(stats.STATISTICS_MINIMUM) : hist.min ?? null,
    maximum: stats.STATISTICS_MAXIMUM != null ? Number(stats.STATISTICS_MAXIMUM) : hist.max ?? null,
    mean: stats.STATISTICS_MEAN != null ? Number(stats.STATISTICS_MEAN) : null,
    negativePixelCount: histAgg.negative,
    nonFinitePixelCount: histAgg.nonFinite,
    validPixelCount: histAgg.valid,
    nodataPixelCount: histAgg.nodata,
    populationSum: Math.round(histAgg.sum),
    cellSemantics: 'persons_per_pixel',
    effectiveResolutionM,
  }
}

export async function inspectPopulationRaster(path: string): Promise<PopulationRasterInspection> {
  const json = await gdalInfoJson(path)
  return parsePopulationRasterInspection(path, json)
}

export function populationDiffPct(reference: number, observed: number): number {
  if (reference === 0) return observed === 0 ? 0 : 100
  return Math.round((Math.abs(observed - reference) / reference) * 10000) / 100
}
