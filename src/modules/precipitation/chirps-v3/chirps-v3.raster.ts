/**
 * CHIRPS v3 — raster extraction (GDAL clip to Guatemala bbox, Float32 read).
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'

import { runCommand, gdalInfoJsonNoHist } from '@/modules/territory/population/processing/gdal'
import {
  CHIRPS_V3_GRID_RESOLUTION_DEG,
  GUATEMALA_BBOX,
} from '@/modules/precipitation/chirps-v3/chirps-v3.config'
import type { ChirpsGridCell, ChirpsGridSnapshot } from '@/modules/precipitation/chirps-v3/chirps-grid.types'
import type { ChirpsVariant } from '@/modules/precipitation/chirps-v3/chirps-v3.urls'

const CLIP_TEMP = resolve(process.cwd(), 'data/climate/chirps/v3/processed/_clip_temp')

function isNodata(value: number, nodata: number | null): boolean {
  if (!Number.isFinite(value)) return true
  if (nodata == null) return false
  if (value === nodata) return true
  if (Math.abs(value - nodata) < 1e-6) return true
  return false
}

function tempEnviBase(path: string): string {
  const hash = createHash('sha256').update(path).digest('hex').slice(0, 16)
  mkdirSync(CLIP_TEMP, { recursive: true })
  return resolve(CLIP_TEMP, `_chirps_envi_${hash}`)
}

/** Clip CHIRPS GeoTIFF to Guatemala bounding box and read grid cells. */
export async function readChirpsGridFromTif(
  tifPath: string,
  meta: { variant: ChirpsVariant; pentadKey: string; sourceUrl: string; checksum?: string },
): Promise<ChirpsGridSnapshot> {
  if (!existsSync(tifPath)) throw new Error(`CHIRPS TIF no encontrado: ${tifPath}`)

  const [west, south, east, north] = GUATEMALA_BBOX
  const enviBase = tempEnviBase(tifPath)
  const res = await runCommand('gdal_translate', [
    '-projwin',
    String(west),
    String(north),
    String(east),
    String(south),
    '-of',
    'ENVI',
    '-ot',
    'Float32',
    tifPath,
    enviBase,
  ])
  if (res.exitCode !== 0) {
    throw new Error(`gdal_translate CHIRPS falló: ${res.stderr || res.stdout}`)
  }

  try {
    const json = await gdalInfoJsonNoHist(enviBase)
    const sizeRaw = json.size as number[] | undefined
    const width = sizeRaw?.[0] ?? 0
    const height = sizeRaw?.[1] ?? 0
    const geoTransform = json.geoTransform as number[] | undefined
    const originLon = geoTransform?.[0] ?? west
    const pixelW = geoTransform?.[1] ?? CHIRPS_V3_GRID_RESOLUTION_DEG
    const pixelH = geoTransform?.[5] ?? -CHIRPS_V3_GRID_RESOLUTION_DEG
    const bands = (json.bands as Array<Record<string, unknown>>) ?? []
    const nodata =
      bands[0]?.noDataValue != null && bands[0]?.noDataValue !== 'null'
        ? Number(bands[0]?.noDataValue)
        : -9999

    const buffer = readFileSync(enviBase)
    const view = new Float32Array(buffer.buffer, buffer.byteOffset, width * height)
    const cells: ChirpsGridCell[] = []

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const idx = row * width + col
        const value = view[idx]!
        const cellLat = (geoTransform?.[3] ?? north) + row * pixelH + pixelH / 2
        const cellLon = (geoTransform?.[0] ?? west) + col * pixelW + pixelW / 2
        const noData = isNodata(value, nodata)
        cells.push({
          row,
          col,
          lat: cellLat,
          lon: cellLon,
          precipitationMm: noData ? 0 : Math.max(0, value),
          isNoData: noData,
        })
      }
    }

    return {
      cells,
      rows: height,
      cols: width,
      originLat: geoTransform?.[3] ?? north,
      originLon,
      resolutionDeg: Math.abs(pixelW),
      variant: meta.variant,
      pentadKey: meta.pentadKey,
      checksum: meta.checksum,
      sourceUrl: meta.sourceUrl,
    }
  } finally {
    if (existsSync(enviBase)) unlinkSync(enviBase)
    if (existsSync(`${enviBase}.hdr`)) unlinkSync(`${enviBase}.hdr`)
  }
}

/** Build grid snapshot from explicit cells (tests / fixtures). */
export function gridFromCells(
  cells: ChirpsGridCell[],
  meta: { variant: ChirpsVariant; pentadKey: string; sourceUrl: string },
): ChirpsGridSnapshot {
  const rows = cells.length ? Math.max(...cells.map((c) => c.row)) + 1 : 0
  const cols = cells.length ? Math.max(...cells.map((c) => c.col)) + 1 : 0
  return {
    cells,
    rows,
    cols,
    originLat: 17.82,
    originLon: -92.35,
    resolutionDeg: CHIRPS_V3_GRID_RESOLUTION_DEG,
    variant: meta.variant,
    pentadKey: meta.pentadKey,
    sourceUrl: meta.sourceUrl,
  }
}

export async function isGdalAvailable(): Promise<boolean> {
  try {
    const res = await runCommand('gdalinfo', ['--version'])
    return res.exitCode === 0
  } catch {
    return false
  }
}
