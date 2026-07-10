import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { gdalInfoJson } from '@/modules/territory/land-cover/processing/gdal'
import { loadManifest, saveManifest } from '@/modules/territory/land-cover/processing/manifest-io'
import {
  LAND_COVER_ANALYTIC_COG,
  LAND_COVER_SOURCE_COG,
  LAND_COVER_TILES_DIR,
} from '@/modules/territory/land-cover/processing/paths'
import { readBoundaryReferenceAreaSqkm } from '@/modules/territory/land-cover/audit/boundary-area'
import {
  classPercentages,
  parseGdalInfoJson,
  type RasterBandSummary,
} from '@/modules/territory/land-cover/processing/raster-stats'

function tileFilename(tileId: string): string {
  return `ESA_WorldCover_10m_2021_v200_${tileId}_Map.tif`
}

export interface TileValidation {
  tile_id: string
  summary: RasterBandSummary
  ok: boolean
  errors: string[]
}

export interface ValidateResult {
  tiles: TileValidation[]
  source_cog: RasterBandSummary
  laea_cog: RasterBandSummary
  class_integrity: {
    source_unknown_codes: number[]
    laea_unknown_codes: number[]
    codes_lost_in_laea: number[]
    codes_gained_in_laea: number[]
  }
  national_area_laea: {
    total_valid_km2: number
    national_reference_km2: number
    difference_pct: number
    class_breakdown: Array<{ code: number; pct: number; area_km2: number }>
    nodata_pixels: number
  }
  ok: boolean
}

function validateTileSummary(summary: RasterBandSummary, expectEpsg4326: boolean): string[] {
  const errors: string[] = []
  if (expectEpsg4326 && summary.crs !== 'EPSG:4326') {
    errors.push(`CRS esperado EPSG:4326, obtenido ${summary.crs}`)
  }
  if (summary.unknown_class_codes.length > 0) {
    errors.push(`Códigos de clase desconocidos: ${summary.unknown_class_codes.join(', ')}`)
  }
  if (summary.size.width < 1 || summary.size.height < 1) {
    errors.push('Dimensiones inválidas')
  }
  return errors
}

export async function validateLandCoverArtifacts(): Promise<ValidateResult> {
  const manifest = loadManifest()
  const tileResults: TileValidation[] = []

  for (const raw of manifest.tiles_required) {
    const tileId = String(raw.tile_id)
    const path = resolve(LAND_COVER_TILES_DIR, tileFilename(tileId))
    if (!existsSync(path)) {
      throw new Error(`Tile no encontrado para validación: ${tileId}`)
    }
    const json = await gdalInfoJson(path)
    const summary = parseGdalInfoJson(path, json)
    const errors = validateTileSummary(summary, true)
    tileResults.push({
      tile_id: tileId,
      summary,
      ok: errors.length === 0,
      errors,
    })
    if (errors.length > 0) {
      throw new Error(`Validación tile ${tileId} falló: ${errors.join('; ')}`)
    }
    raw.status = 'validated'
    raw.validated_at = new Date().toISOString()
  }

  if (!existsSync(LAND_COVER_SOURCE_COG) || !existsSync(LAND_COVER_ANALYTIC_COG)) {
    throw new Error('COGs procesados no encontrados — ejecutar land-cover:build primero')
  }

  const sourceJson = await gdalInfoJson(LAND_COVER_SOURCE_COG)
  const laeaJson = await gdalInfoJson(LAND_COVER_ANALYTIC_COG)
  const source_cog = parseGdalInfoJson(LAND_COVER_SOURCE_COG, sourceJson)
  const laea_cog = parseGdalInfoJson(LAND_COVER_ANALYTIC_COG, laeaJson)

  const sourceCodes = new Set(
    Object.keys(source_cog.class_histogram)
      .map(Number)
      .filter((c) => c > 0),
  )
  const laeaCodes = new Set(
    Object.keys(laea_cog.class_histogram)
      .map(Number)
      .filter((c) => c > 0),
  )

  const codes_lost = [...sourceCodes].filter((c) => !laeaCodes.has(c))
  const codes_gained = [...laeaCodes].filter((c) => !sourceCodes.has(c))

  const pixelW = laea_cog.pixel_size?.[0] ?? 10
  const pixelH = laea_cog.pixel_size?.[1] ?? 10
  const pixelAreaM2 = pixelW * pixelH
  const breakdown = classPercentages(laea_cog, pixelAreaM2)
  const totalValidKm2 = breakdown.reduce((s, r) => s + r.area_km2, 0)
  const boundaryReferenceKm2 = readBoundaryReferenceAreaSqkm('laea')
  const diffPct =
    boundaryReferenceKm2 > 0
      ? ((totalValidKm2 - boundaryReferenceKm2) / boundaryReferenceKm2) * 100
      : 0

  manifest.processing = {
    ...(manifest.processing as Record<string, unknown> | undefined),
    validation_completed_at: new Date().toISOString(),
    national_area_valid_km2: Math.round(totalValidKm2),
    national_area_difference_pct: Math.round(diffPct * 100) / 100,
    laea_pixel_size_m: [pixelW, pixelH],
  }
  saveManifest(manifest)

  const ok =
    tileResults.every((t) => t.ok) &&
    source_cog.unknown_class_codes.length === 0 &&
    laea_cog.unknown_class_codes.length === 0 &&
    codes_gained.length === 0

  return {
    tiles: tileResults,
    source_cog,
    laea_cog,
    class_integrity: {
      source_unknown_codes: source_cog.unknown_class_codes,
      laea_unknown_codes: laea_cog.unknown_class_codes,
      codes_lost_in_laea: codes_lost,
      codes_gained_in_laea: codes_gained,
    },
    national_area_laea: {
      total_valid_km2: Math.round(totalValidKm2 * 10) / 10,
      national_reference_km2: Math.round(boundaryReferenceKm2 * 10) / 10,
      difference_pct: Math.round(diffPct * 100) / 100,
      class_breakdown: breakdown.map((b) => ({
        code: b.code,
        pct: Math.round(b.pct * 10) / 10,
        area_km2: Math.round(b.area_km2 * 10) / 10,
      })),
      nodata_pixels: laea_cog.nodata_pixel_count,
    },
    ok,
  }
}
