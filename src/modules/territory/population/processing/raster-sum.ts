import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'

import { gdalInfoJsonNoHist, runCommand } from '@/modules/territory/population/processing/gdal'
import { POPULATION_CLIP_TEMP_DIR } from '@/modules/territory/population/processing/paths'

export interface PopulationRasterSumResult {
  path: string
  method: 'pixel_read_float32'
  command: string
  band: number
  nodata: number | null
  width: number
  height: number
  pixelCount: number
  validCount: number
  nodataCount: number
  negativeCount: number
  nonFiniteCount: number
  zeroCount: number
  totalSum: number
  usedCachedStatistics: false
}

function isNodata(value: number, nodata: number | null): boolean {
  if (!Number.isFinite(value)) return true
  if (nodata == null) return false
  if (value === nodata) return true
  if (Math.abs(value - nodata) < 1e-6) return true
  return false
}

function tempEnviBase(path: string): string {
  const hash = createHash('sha256').update(path).digest('hex').slice(0, 16)
  mkdirSync(POPULATION_CLIP_TEMP_DIR, { recursive: true })
  return resolve(POPULATION_CLIP_TEMP_DIR, `_sum_envi_${hash}`)
}

/**
 * Suma exacta leyendo todos los píxeles Float32 (sin histogramas ni stats cacheadas).
 */
export async function calculatePopulationRasterSum(
  path: string,
): Promise<PopulationRasterSumResult> {
  const json = await gdalInfoJsonNoHist(path)
  const sizeRaw = json.size as number[] | undefined
  const width = sizeRaw?.[0] ?? 0
  const height = sizeRaw?.[1] ?? 0
  const bands = (json.bands as Array<Record<string, unknown>>) ?? []
  const band1 = bands[0] ?? {}
  const nodata =
    band1.noDataValue != null && band1.noDataValue !== 'null'
      ? Number(band1.noDataValue)
      : null

  const enviBase = tempEnviBase(path)
  const enviBin = enviBase
  const enviHdr = `${enviBase}.hdr`

  const command = `gdal_translate -of ENVI -ot Float32 "${path}" "${enviBase}"`
  const res = await runCommand('gdal_translate', ['-of', 'ENVI', '-ot', 'Float32', path, enviBase])
  if (res.exitCode !== 0) {
    throw new Error(`gdal_translate ENVI falló (${path}): ${res.stderr || res.stdout}`)
  }

  try {
    const buffer = readFileSync(enviBin)
    const expectedBytes = width * height * 4
    if (buffer.byteLength < expectedBytes) {
      throw new Error(
        `ENVI size mismatch: expected ${expectedBytes} bytes, got ${buffer.byteLength} for ${path}`,
      )
    }

    const view = new Float32Array(buffer.buffer, buffer.byteOffset, width * height)
    let totalSum = 0
    let validCount = 0
    let nodataCount = 0
    let negativeCount = 0
    let nonFiniteCount = 0
    let zeroCount = 0

    for (let i = 0; i < view.length; i++) {
      const v = view[i]!
      if (!Number.isFinite(v)) {
        nonFiniteCount += 1
        continue
      }
      if (isNodata(v, nodata)) {
        nodataCount += 1
        continue
      }
      if (v < 0) {
        negativeCount += 1
        continue
      }
      if (v === 0) {
        zeroCount += 1
        validCount += 1
        continue
      }
      totalSum += v
      validCount += 1
    }

    return {
      path,
      method: 'pixel_read_float32',
      command,
      band: 1,
      nodata,
      width,
      height,
      pixelCount: width * height,
      validCount,
      nodataCount,
      negativeCount,
      nonFiniteCount,
      zeroCount,
      totalSum: Math.round(totalSum),
      usedCachedStatistics: false,
    }
  } finally {
    if (existsSync(enviBin)) unlinkSync(enviBin)
    if (existsSync(enviHdr)) unlinkSync(enviHdr)
  }
}
