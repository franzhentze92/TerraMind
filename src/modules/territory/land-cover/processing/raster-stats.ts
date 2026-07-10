import { ESA_WORLDCOVER_V200_CLASSES } from '@/modules/territory/land-cover/providers/esa-worldcover/esa-worldcover.mapper'

const VALID_CODES = new Set([
  0,
  ...ESA_WORLDCOVER_V200_CLASSES.map((c) => c.code),
])

export interface RasterBandSummary {
  path: string
  crs: string | null
  size: { width: number; height: number }
  pixel_size: [number, number] | null
  nodata: number | null
  data_type: string | null
  bounds: [number, number, number, number] | null
  class_histogram: Record<string, number>
  valid_pixel_count: number
  nodata_pixel_count: number
  unknown_class_codes: number[]
}

export function parseGdalInfoJson(
  path: string,
  json: Record<string, unknown>,
): RasterBandSummary {
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
  const gdalMetadata = (json.metadata as Record<string, Record<string, string>> | undefined)?.[''] ?? {}
  const bands = (json.bands as Array<Record<string, unknown>>) ?? []
  const band1 = bands[0] ?? {}
  const bandMetadata = (band1.metadata as Record<string, Record<string, string>>) ?? {}
  const stats = bandMetadata[''] ?? {}

  const cs = json.coordinateSystem as
    | { wkt?: string; proj4?: string; authority?: { code?: string | number } }
    | undefined
  const wkt = cs?.wkt ?? ''
  const epsgCode = cs?.authority?.code != null ? String(cs.authority.code) : ''
  let crs: string | null = null
  if (wkt.includes('Lambert Azimuthal Equal Area') || (cs?.proj4 ?? '').includes('laea')) {
    crs = 'LAEA-GT'
  } else if (
    epsgCode === '4326' ||
    gdalMetadata.product_crs === 'EPSG:4326' ||
    (wkt.includes('GEOGCRS') && wkt.includes('WGS 84'))
  ) {
    crs = 'EPSG:4326'
  } else if (wkt) {
    crs = wkt.slice(0, 80)
  }

  let pixel_size: [number, number] | null = null
  if (geoTransform && geoTransform.length >= 6) {
    pixel_size = [geoTransform[1], Math.abs(geoTransform[5])]
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

  const histogram: Record<string, number> = {}
  const hist = (band1.histogram as { buckets?: number[]; min?: number; max?: number; count?: number } | undefined)
  const buckets = hist?.buckets ?? []
  const min = hist?.min ?? 0
  const max = hist?.max ?? 0
  const count = hist?.count ?? buckets.length
  const unknown_class_codes: number[] = []

  if (buckets.length > 0 && count > 1) {
    const step = count > 1 ? (max - min) / (count - 1) : 1
    for (let i = 0; i < buckets.length; i++) {
      const value = Math.round(min + step * i)
      const bucketCount = buckets[i] ?? 0
      if (bucketCount === 0) continue
      histogram[String(value)] = (histogram[String(value)] ?? 0) + bucketCount
      if (!VALID_CODES.has(value) && value !== 0) {
        unknown_class_codes.push(value)
      }
    }
  }

  let valid_pixel_count = 0
  let nodata_pixel_count = histogram['0'] ?? 0
  for (const [code, cnt] of Object.entries(histogram)) {
    const n = Number(code)
    if (n === 0) continue
    if (VALID_CODES.has(n)) valid_pixel_count += cnt
  }

  const nodataRaw = stats.NODATA_VALUE ?? (band1.noDataValue as string | undefined)
  const nodata = nodataRaw != null ? Number(nodataRaw) : 0

  return {
    path,
    crs,
    size: { width, height },
    pixel_size,
    nodata: Number.isFinite(nodata) ? nodata : 0,
    data_type: (band1.type as string | undefined) ?? null,
    bounds,
    class_histogram: histogram,
    valid_pixel_count,
    nodata_pixel_count,
    unknown_class_codes: [...new Set(unknown_class_codes)],
  }
}

export function classPercentages(
  summary: RasterBandSummary,
  pixelAreaM2: number,
): Array<{ code: number; count: number; pct: number; area_km2: number }> {
  const totalValid = summary.valid_pixel_count || 1
  return Object.entries(summary.class_histogram)
    .map(([code, count]) => {
      const n = Number(code)
      if (n === 0 || !VALID_CODES.has(n)) return null
      return {
        code: n,
        count,
        pct: (count / totalValid) * 100,
        area_km2: (count * pixelAreaM2) / 1_000_000,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.count - a.count)
}
