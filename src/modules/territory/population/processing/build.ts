import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { runCommand } from '@/modules/territory/population/processing/gdal'
import {
  loadPopulationManifest,
  savePopulationManifest,
  sha256File,
  type PopulationConservationEntry,
} from '@/modules/territory/population/processing/manifest-io'
import {
  GUATEMALA_ADM0_GEOJSON,
  LAEA_PROJ4,
  POPULATION_CLIP_TEMP_DIR,
  POPULATION_PROCESSED_DIR,
  POPULATION_SUM_TOLERANCE_PCT,
  processedLaeaCog,
  processedWgs84Cog,
  rawRasterPath,
} from '@/modules/territory/population/processing/paths'
import {
  inspectPopulationRaster,
  populationDiffPct,
} from '@/modules/territory/population/processing/raster-stats'
import type { WorldPopVariant } from '@/modules/territory/population/providers/worldpop/worldpop-products'

export interface PrepareVariantResult {
  variant: WorldPopVariant
  raw_sum: number
  wgs84_clip_sum: number
  wgs84_cog_sum: number
  laea_cog_sum: number
  diff_wgs84_clip_pct: number
  diff_laea_pct: number
  wgs84_cog_bytes: number
  laea_cog_bytes: number
  laea_approved: boolean
}

function clipTemp(variant: WorldPopVariant, stage: string): string {
  return resolve(POPULATION_CLIP_TEMP_DIR, `${variant}_${stage}.tif`)
}

async function assertOk(label: string, res: { exitCode: number; stderr: string; stdout: string }) {
  if (res.exitCode !== 0) {
    throw new Error(`${label} falló: ${res.stderr || res.stdout}`)
  }
}

export async function prepareWorldPopVariant(
  variant: WorldPopVariant,
): Promise<PrepareVariantResult> {
  const rawPath = rawRasterPath(variant)
  if (!existsSync(rawPath)) {
    throw new Error(`Raster fuente no encontrado: ${rawPath}. Ejecutar population:download-worldpop.`)
  }
  if (!existsSync(GUATEMALA_ADM0_GEOJSON)) {
    throw new Error(`Boundary ADM0 no encontrado: ${GUATEMALA_ADM0_GEOJSON}`)
  }

  mkdirSync(POPULATION_PROCESSED_DIR, { recursive: true })
  mkdirSync(POPULATION_CLIP_TEMP_DIR, { recursive: true })

  const rawInspection = await inspectPopulationRaster(rawPath)
  const wgs84Out = processedWgs84Cog(variant)
  const laeaOut = processedLaeaCog(variant)
  const clipPath = clipTemp(variant, 'clip_wgs84')
  if (existsSync(wgs84Out)) unlinkSync(wgs84Out)
  if (existsSync(laeaOut)) unlinkSync(laeaOut)

  // Clip to ADM0 — same CRS, no resampling interpolation
  const clipRes = await runCommand('gdalwarp', [
    '-overwrite',
    '-cutline',
    GUATEMALA_ADM0_GEOJSON,
    '-crop_to_cutline',
    '-dstnodata',
    '-9999',
    '-multi',
    '-wo',
    'NUM_THREADS=ALL_CPUS',
    rawPath,
    clipPath,
  ])
  await assertOk('gdalwarp clip ADM0', clipRes)

  const clipInspection = await inspectPopulationRaster(clipPath)

  const cogRes = await runCommand('gdal_translate', [
    '-of',
    'COG',
    '-co',
    'COMPRESS=DEFLATE',
    '-co',
    'BLOCKSIZE=512',
    '-co',
    'OVERVIEWS=IGNORE_EXISTING',
    clipPath,
    wgs84Out,
  ])
  await assertOk('gdal_translate COG WGS84', cogRes)

  const wgs84Inspection = await inspectPopulationRaster(wgs84Out)

  // Mass-conserving reprojection for quantitative population raster
  const laeaRes = await runCommand('gdalwarp', [
    '-overwrite',
    '-of',
    'COG',
    '-co',
    'COMPRESS=DEFLATE',
    '-co',
    'BLOCKSIZE=512',
    '-t_srs',
    LAEA_PROJ4,
    '-r',
    'sum',
    '-dstnodata',
    '-9999',
    '-multi',
    '-wo',
    'NUM_THREADS=ALL_CPUS',
    wgs84Out,
    laeaOut,
  ])
  await assertOk('gdalwarp COG LAEA (resampling=sum)', laeaRes)

  const laeaInspection = await inspectPopulationRaster(laeaOut)
  const diffClipPct = populationDiffPct(rawInspection.populationSum, clipInspection.populationSum)
  const diffLaeaPct = populationDiffPct(wgs84Inspection.populationSum, laeaInspection.populationSum)
  const tolerance = POPULATION_SUM_TOLERANCE_PCT[variant]
  const laeaApproved = diffLaeaPct <= tolerance

  if (!laeaApproved) {
    if (existsSync(laeaOut)) unlinkSync(laeaOut)
    const conservationEntry: PopulationConservationEntry = {
      variant,
      raw_sum: rawInspection.populationSum,
      wgs84_clip_sum: clipInspection.populationSum,
      wgs84_cog_sum: wgs84Inspection.populationSum,
      laea_cog_sum: laeaInspection.populationSum,
      diff_wgs84_clip_pct: diffClipPct,
      diff_laea_pct: diffLaeaPct,
      outside_adm0_population: Math.max(
        0,
        rawInspection.populationSum - clipInspection.populationSum,
      ),
      nodata_inside_adm0_pixels: clipInspection.nodataPixelCount,
    }
    if (variant === 'unconstrained') {
      const manifest = loadPopulationManifest()
      manifest.conservation = [
        ...(manifest.conservation ?? []).filter((c) => c.variant !== variant),
        conservationEntry,
      ]
      manifest.artifacts = {
        ...(manifest.artifacts ?? {}),
        [`${variant}_wgs84_cog`]: wgs84Out.replace(process.cwd(), '.'),
        [`${variant}_wgs84_sha256`]: await sha256File(wgs84Out),
        unconstrained_laea_skipped: true,
        unconstrained_laea_skip_reason: `Conservación LAEA ${diffLaeaPct}% > ${tolerance}% — usar WGS84 COG para auditoría.`,
      }
      manifest.prepare_completed_at = new Date().toISOString()
      savePopulationManifest(manifest)
      if (existsSync(clipPath)) unlinkSync(clipPath)
      return {
        variant,
        raw_sum: rawInspection.populationSum,
        wgs84_clip_sum: clipInspection.populationSum,
        wgs84_cog_sum: wgs84Inspection.populationSum,
        laea_cog_sum: laeaInspection.populationSum,
        diff_wgs84_clip_pct: diffClipPct,
        diff_laea_pct: diffLaeaPct,
        wgs84_cog_bytes: statSync(wgs84Out).size,
        laea_cog_bytes: 0,
        laea_approved: false,
      }
    }
    throw new Error(
      `Conservación LAEA ${diffLaeaPct}% excede tolerancia ${tolerance}% para ${variant}`,
    )
  }

  const conservation: PopulationConservationEntry = {
    variant,
    raw_sum: rawInspection.populationSum,
    wgs84_clip_sum: clipInspection.populationSum,
    wgs84_cog_sum: wgs84Inspection.populationSum,
    laea_cog_sum: laeaInspection.populationSum,
    diff_wgs84_clip_pct: diffClipPct,
    diff_laea_pct: diffLaeaPct,
    outside_adm0_population: Math.max(
      0,
      rawInspection.populationSum - clipInspection.populationSum,
    ),
    nodata_inside_adm0_pixels: clipInspection.nodataPixelCount,
  }

  const manifest = loadPopulationManifest()
  const existing = manifest.conservation ?? []
  manifest.conservation = [...existing.filter((c) => c.variant !== variant), conservation]
  manifest.artifacts = {
    ...(manifest.artifacts ?? {}),
    [`${variant}_wgs84_cog`]: wgs84Out.replace(process.cwd(), '.'),
    [`${variant}_laea_cog`]: laeaOut.replace(process.cwd(), '.'),
    [`${variant}_wgs84_sha256`]: await sha256File(wgs84Out),
    [`${variant}_laea_sha256`]: await sha256File(laeaOut),
    resampling_laea: 'sum',
    resampling_clip: 'none (same CRS cutline crop)',
  }
  manifest.prepare_completed_at = new Date().toISOString()
  savePopulationManifest(manifest)

  if (existsSync(clipPath)) unlinkSync(clipPath)

  return {
    variant,
    raw_sum: rawInspection.populationSum,
    wgs84_clip_sum: clipInspection.populationSum,
    wgs84_cog_sum: wgs84Inspection.populationSum,
    laea_cog_sum: laeaInspection.populationSum,
    diff_wgs84_clip_pct: diffClipPct,
    diff_laea_pct: diffLaeaPct,
    wgs84_cog_bytes: statSync(wgs84Out).size,
    laea_cog_bytes: statSync(laeaOut).size,
    laea_approved: laeaApproved,
  }
}

export async function prepareWorldPopCogs(): Promise<PrepareVariantResult[]> {
  const results: PrepareVariantResult[] = []
  for (const variant of ['constrained', 'unconstrained'] as const) {
    results.push(await prepareWorldPopVariant(variant))
  }
  return results
}
