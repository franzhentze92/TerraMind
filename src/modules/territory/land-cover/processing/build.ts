import { existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { runCommand, gdalInfoJson } from '@/modules/territory/land-cover/processing/gdal'
import {
  loadManifest,
  saveManifest,
  sha256File,
  writeSha256Sums,
} from '@/modules/territory/land-cover/processing/manifest-io'
import {
  GUATEMALA_ADM0_GEOJSON,
  LAEA_PROJ4,
  LAND_COVER_ANALYTIC_COG,
  LAND_COVER_CLIP_TEMP,
  LAND_COVER_MOSAIC_VRT,
  LAND_COVER_PROCESSED_DIR,
  LAND_COVER_SOURCE_COG,
  LAND_COVER_TILES_DIR,
} from '@/modules/territory/land-cover/processing/paths'
import { parseGdalInfoJson } from '@/modules/territory/land-cover/processing/raster-stats'

function tileFilename(tileId: string): string {
  return `ESA_WorldCover_10m_2021_v200_${tileId}_Map.tif`
}

export interface BuildResult {
  mosaic_ms: number
  clip_ms: number
  source_cog_ms: number
  laea_cog_ms: number
  source_cog_bytes: number
  laea_cog_bytes: number
  total_storage_bytes: number
}

export async function buildLandCoverCogs(): Promise<BuildResult> {
  if (!existsSync(GUATEMALA_ADM0_GEOJSON)) {
    throw new Error(`Boundary ADM0 no encontrado: ${GUATEMALA_ADM0_GEOJSON}`)
  }

  mkdirSync(LAND_COVER_PROCESSED_DIR, { recursive: true })
  const manifest = loadManifest()
  const tilePaths = manifest.tiles_required.map((t) =>
    resolve(LAND_COVER_TILES_DIR, tileFilename(String(t.tile_id))),
  )
  for (const p of tilePaths) {
    if (!existsSync(p)) throw new Error(`Tile faltante: ${p}`)
  }

  for (const p of tilePaths) {
    const json = await gdalInfoJson(p)
    const summary = parseGdalInfoJson(p, json)
    if (summary.crs !== 'EPSG:4326') {
      throw new Error(`Tile ${p}: CRS inválido ${summary.crs}`)
    }
    if (summary.unknown_class_codes.length > 0) {
      throw new Error(`Tile ${p}: clases desconocidas ${summary.unknown_class_codes.join(',')}`)
    }
  }

  const metrics: BuildResult = {
    mosaic_ms: 0,
    clip_ms: 0,
    source_cog_ms: 0,
    laea_cog_ms: 0,
    source_cog_bytes: 0,
    laea_cog_bytes: 0,
    total_storage_bytes: 0,
  }

  // A. Mosaic VRT
  let t0 = Date.now()
  const vrtArgs = [
    '-overwrite',
    '-srcnodata',
    '0',
    '-vrtnodata',
    '0',
    LAND_COVER_MOSAIC_VRT,
    ...tilePaths,
  ]
  const vrtRes = await runCommand('gdalbuildvrt', vrtArgs)
  if (vrtRes.exitCode !== 0) {
    throw new Error(`gdalbuildvrt falló: ${vrtRes.stderr || vrtRes.stdout}`)
  }
  metrics.mosaic_ms = Date.now() - t0

  // B. Clip to Guatemala ADM0
  t0 = Date.now()
  const warpRes = await runCommand('gdalwarp', [
    '-cutline',
    GUATEMALA_ADM0_GEOJSON,
    '-crop_to_cutline',
    '-dstnodata',
    '0',
    '-multi',
    '-wo',
    'NUM_THREADS=ALL_CPUS',
    LAND_COVER_MOSAIC_VRT,
    LAND_COVER_CLIP_TEMP,
  ])
  if (warpRes.exitCode !== 0) {
    throw new Error(`gdalwarp clip falló: ${warpRes.stderr || warpRes.stdout}`)
  }
  metrics.clip_ms = Date.now() - t0

  // D. Source COG EPSG:4326
  t0 = Date.now()
  const cogRes = await runCommand('gdal_translate', [
    '-of',
    'COG',
    '-co',
    'COMPRESS=DEFLATE',
    '-co',
    'BLOCKSIZE=512',
    '-co',
    'OVERVIEWS=IGNORE_EXISTING',
    LAND_COVER_CLIP_TEMP,
    LAND_COVER_SOURCE_COG,
  ])
  if (cogRes.exitCode !== 0) {
    throw new Error(`gdal_translate COG 4326 falló: ${cogRes.stderr || cogRes.stdout}`)
  }
  metrics.source_cog_ms = Date.now() - t0

  // E. Analytic COG LAEA (nearest neighbor)
  t0 = Date.now()
  const laeaRes = await runCommand('gdalwarp', [
    '-of',
    'COG',
    '-co',
    'COMPRESS=DEFLATE',
    '-co',
    'BLOCKSIZE=512',
    '-t_srs',
    LAEA_PROJ4,
    '-r',
    'near',
    '-dstnodata',
    '0',
    '-multi',
    '-wo',
    'NUM_THREADS=ALL_CPUS',
    LAND_COVER_SOURCE_COG,
    LAND_COVER_ANALYTIC_COG,
  ])
  if (laeaRes.exitCode !== 0) {
    throw new Error(`gdalwarp LAEA falló: ${laeaRes.stderr || laeaRes.stdout}`)
  }
  metrics.laea_cog_ms = Date.now() - t0

  metrics.source_cog_bytes = statSync(LAND_COVER_SOURCE_COG).size
  metrics.laea_cog_bytes = statSync(LAND_COVER_ANALYTIC_COG).size
  metrics.total_storage_bytes = metrics.source_cog_bytes + metrics.laea_cog_bytes

  if (metrics.total_storage_bytes > 400 * 1024 * 1024) {
    throw new Error(
      `Almacenamiento COG ${(metrics.total_storage_bytes / 1024 / 1024).toFixed(1)} MB excede 400 MB — detener antes de 7A.2-C`,
    )
  }

  const sourceHash = await sha256File(LAND_COVER_SOURCE_COG)
  const laeaHash = await sha256File(LAND_COVER_ANALYTIC_COG)
  writeSha256Sums([
    { path: LAND_COVER_SOURCE_COG, sha256: sourceHash, label: 'processed/land_cover_gt_4326.tif' },
    { path: LAND_COVER_ANALYTIC_COG, sha256: laeaHash, label: 'processed/land_cover_gt_laea.tif' },
    ...manifest.tiles_required.map((t) => ({
      path: resolve(LAND_COVER_TILES_DIR, tileFilename(String(t.tile_id))),
      sha256: String(t.sha256),
      label: `tiles/${tileFilename(String(t.tile_id))}`,
    })),
  ])

  manifest.artifacts = {
    source_cog: 'processed/land_cover_gt_4326.tif',
    analytic_cog: 'processed/land_cover_gt_laea.tif',
    source_cog_sha256: sourceHash,
    analytic_cog_sha256: laeaHash,
    source_cog_bytes: metrics.source_cog_bytes,
    analytic_cog_bytes: metrics.laea_cog_bytes,
    laea_proj4: LAEA_PROJ4,
    clip_boundary: 'hdx-cod-ab gtm_admin0.geojson',
    resampling_laea: 'near',
  }
  manifest.processing = {
    ...(manifest.processing as Record<string, unknown> | undefined),
    build_completed_at: new Date().toISOString(),
    mosaic_ms: metrics.mosaic_ms,
    clip_ms: metrics.clip_ms,
    source_cog_ms: metrics.source_cog_ms,
    laea_cog_ms: metrics.laea_cog_ms,
    optimization_notes: {
      option_a_dual_cog_mb: Math.round((metrics.total_storage_bytes / 1024 / 1024) * 10) / 10,
      option_b_on_demand_warp: 'Reproyectar ventanas pequeñas desde COG 4326 — evaluar en 7A.2-C',
    },
  }
  saveManifest(manifest)

  if (existsSync(LAND_COVER_CLIP_TEMP)) unlinkSync(LAND_COVER_CLIP_TEMP)

  return metrics
}
