import { existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'

import { runCommand } from '@/modules/territory/population/processing/gdal'
import {
  loadPopulationManifest,
  savePopulationManifest,
  sha256File,
  type PopulationConservationEntry,
} from '@/modules/territory/population/processing/manifest-io'
import {
  POPULATION_7D1A_SUPERSEDED,
} from '@/modules/territory/population/processing/population-7d1a-superseded'
import {
  evaluateConservationDeltaPct,
  populationDiffPct,
} from '@/modules/territory/population/processing/population-conservation'
import {
  GUATEMALA_ADM0_GEOJSON,
  LAEA_PROJ4,
  POPULATION_CLIP_TEMP_DIR,
  POPULATION_PROCESSED_DIR,
  processedLaeaCog,
  processedWgs84Cog,
  rawRasterPath,
} from '@/modules/territory/population/processing/paths'
import { calculatePopulationRasterSum } from '@/modules/territory/population/processing/raster-sum'
import type { WorldPopVariant } from '@/modules/territory/population/providers/worldpop/worldpop-products'

export interface PrepareVariantResult {
  variant: WorldPopVariant
  raw_sum: number
  inside_adm0_sum: number
  outside_adm0_sum: number
  wgs84_cog_sum: number
  laea_cog_sum: number
  diff_inside_vs_raw_pct: number
  diff_wgs84_vs_inside_pct: number
  diff_laea_pct: number
  wgs84_cog_bytes: number
  laea_cog_bytes: number
  wgs84_approved: boolean
  laea_approved: boolean
  laea_verdict: string
  clip_policy: string
  resampling_laea: string
  superseded_histogram_sums?: {
    raw?: number
    wgs84_clip?: number
    laea?: number
  }
}

function clipTemp(variant: WorldPopVariant, stage: string): string {
  return resolve(POPULATION_CLIP_TEMP_DIR, `${variant}_${stage}.tif`)
}

async function assertOk(label: string, res: { exitCode: number; stderr: string; stdout: string }) {
  if (res.exitCode !== 0) {
    throw new Error(`${label} falló: ${res.stderr || res.stdout}`)
  }
}

const CLIP_POLICY =
  'gdalwarp -cutline ADM0 -crop_to_cutline; center-of-pixel inclusion (default); sin resampling; dstnodata=-9999'

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

  const rawSumResult = await calculatePopulationRasterSum(rawPath)

  const wgs84Out = processedWgs84Cog(variant)
  const laeaOut = processedLaeaCog(variant)
  const clipPath = clipTemp(variant, 'clip_wgs84')
  if (existsSync(wgs84Out)) unlinkSync(wgs84Out)
  if (existsSync(laeaOut)) unlinkSync(laeaOut)

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

  const insideSumResult = await calculatePopulationRasterSum(clipPath)
  const outsideAdm0 = Math.max(0, rawSumResult.totalSum - insideSumResult.totalSum)

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

  const wgs84SumResult = await calculatePopulationRasterSum(wgs84Out)

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

  const laeaSumResult = await calculatePopulationRasterSum(laeaOut)

  const diffInsideVsRawPct = populationDiffPct(rawSumResult.totalSum, insideSumResult.totalSum)
  const diffWgs84VsInsidePct = populationDiffPct(insideSumResult.totalSum, wgs84SumResult.totalSum)
  const diffLaeaPct = populationDiffPct(wgs84SumResult.totalSum, laeaSumResult.totalSum)

  const wgs84Eval = evaluateConservationDeltaPct(diffWgs84VsInsidePct)
  const laeaEval = evaluateConservationDeltaPct(diffLaeaPct)

  const laeaApproved = laeaEval.approved
  if (!laeaApproved && existsSync(laeaOut)) {
    unlinkSync(laeaOut)
  }

  const conservation: PopulationConservationEntry = {
    variant,
    raw_sum: rawSumResult.totalSum,
    inside_adm0_sum: insideSumResult.totalSum,
    outside_adm0_sum: outsideAdm0,
    wgs84_clip_sum: insideSumResult.totalSum,
    wgs84_cog_sum: wgs84SumResult.totalSum,
    laea_cog_sum: laeaApproved ? laeaSumResult.totalSum : 0,
    diff_inside_vs_raw_pct: diffInsideVsRawPct,
    diff_wgs84_vs_inside_pct: diffWgs84VsInsidePct,
    diff_wgs84_clip_pct: diffWgs84VsInsidePct,
    diff_laea_pct: diffLaeaPct,
    outside_adm0_population: outsideAdm0,
    nodata_inside_adm0_pixels: insideSumResult.nodataCount,
    wgs84_verdict: wgs84Eval.verdict,
    laea_verdict: laeaEval.verdict,
    wgs84_approved: wgs84Eval.approved,
    laea_approved: laeaApproved,
    sum_method: 'pixel_read_float32',
    clip_policy: CLIP_POLICY,
    resampling_laea: 'sum',
    superseded_histogram_sums: {
      raw: POPULATION_7D1A_SUPERSEDED[variant].raw_sum,
      wgs84_clip: POPULATION_7D1A_SUPERSEDED[variant].wgs84_clip_sum,
      laea_delta_pct: POPULATION_7D1A_SUPERSEDED[variant].laea_delta_pct,
    },
  }

  const manifest = loadPopulationManifest()
  manifest.conservation = [
    ...(manifest.conservation ?? []).filter((c) => c.variant !== variant),
    conservation,
  ]
  manifest.artifacts = {
    ...(manifest.artifacts ?? {}),
    [`${variant}_wgs84_cog`]: wgs84Out.replace(process.cwd(), '.'),
    [`${variant}_wgs84_sha256`]: await sha256File(wgs84Out),
    resampling_laea: 'sum',
    resampling_clip: 'none (same CRS cutline crop)',
    clip_policy: CLIP_POLICY,
    sum_method: 'pixel_read_float32',
  }
  if (laeaApproved) {
    manifest.artifacts[`${variant}_laea_cog`] = laeaOut.replace(process.cwd(), '.')
    manifest.artifacts[`${variant}_laea_sha256`] = await sha256File(laeaOut)
    delete manifest.artifacts.unconstrained_laea_skipped
    delete manifest.artifacts.unconstrained_laea_skip_reason
  } else {
    delete manifest.artifacts[`${variant}_laea_cog`]
    delete manifest.artifacts[`${variant}_laea_sha256`]
    if (variant === 'unconstrained') {
      manifest.artifacts.unconstrained_laea_skipped = true
      manifest.artifacts.unconstrained_laea_skip_reason = laeaEval.message
    }
  }
  manifest.prepare_completed_at = new Date().toISOString()
  savePopulationManifest(manifest)

  if (existsSync(clipPath)) unlinkSync(clipPath)

  return {
    variant,
    raw_sum: rawSumResult.totalSum,
    inside_adm0_sum: insideSumResult.totalSum,
    outside_adm0_sum: outsideAdm0,
    wgs84_cog_sum: wgs84SumResult.totalSum,
    laea_cog_sum: laeaApproved ? laeaSumResult.totalSum : laeaSumResult.totalSum,
    diff_inside_vs_raw_pct: diffInsideVsRawPct,
    diff_wgs84_vs_inside_pct: diffWgs84VsInsidePct,
    diff_laea_pct: diffLaeaPct,
    wgs84_cog_bytes: statSync(wgs84Out).size,
    laea_cog_bytes: laeaApproved && existsSync(laeaOut) ? statSync(laeaOut).size : 0,
    wgs84_approved: wgs84Eval.approved,
    laea_approved: laeaApproved,
    laea_verdict: laeaEval.verdict,
    clip_policy: CLIP_POLICY,
    resampling_laea: 'sum',
    superseded_histogram_sums: {
      raw: POPULATION_7D1A_SUPERSEDED[variant].raw_sum,
      wgs84_clip: POPULATION_7D1A_SUPERSEDED[variant].wgs84_clip_sum,
    },
  }
}

export async function prepareWorldPopCogs(): Promise<PrepareVariantResult[]> {
  const results: PrepareVariantResult[] = []
  for (const variant of ['constrained', 'unconstrained'] as const) {
    results.push(await prepareWorldPopVariant(variant))
  }
  return results
}
