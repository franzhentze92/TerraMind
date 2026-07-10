import { mkdirSync, existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { runCommand } from '@/modules/territory/land-cover/processing/gdal'
import {
  loadManifest,
  saveManifest,
  sha256File,
  MANIFEST_SCRIPT_VERSION,
} from '@/modules/territory/land-cover/processing/manifest-io'
import { LAND_COVER_TILES_DIR } from '@/modules/territory/land-cover/processing/paths'
import { getToolVersions } from '@/modules/territory/land-cover/processing/gdal'

function tileFilename(tileId: string): string {
  return `ESA_WorldCover_10m_2021_v200_${tileId}_Map.tif`
}

export interface DownloadResult {
  tiles: Array<{
    tile_id: string
    status: string
    size_bytes: number
    sha256: string
    skipped: boolean
    duration_ms: number
  }>
  total_duration_ms: number
  total_bytes: number
}

export async function downloadLandCoverTiles(): Promise<DownloadResult> {
  const started = Date.now()
  mkdirSync(LAND_COVER_TILES_DIR, { recursive: true })

  const manifest = loadManifest()
  const tools = await getToolVersions()

  manifest.download_summary = {
    ...manifest.download_summary,
    download_approved: true,
    download_approved_at: new Date().toISOString(),
    script_version: MANIFEST_SCRIPT_VERSION,
    tools,
  }

  const results: DownloadResult['tiles'] = []
  let totalBytes = 0

  for (const raw of manifest.tiles_required) {
    const tileId = String(raw.tile_id)
    const expectedSize = Number(raw.size_bytes)
    const s3Uri = String(raw.s3_uri)
    const localPath = resolve(LAND_COVER_TILES_DIR, tileFilename(tileId))
    const tileStarted = Date.now()
    let skipped = false

    const priorHash = raw.sha256 as string | undefined
    if (existsSync(localPath)) {
      const size = statSync(localPath).size
      const hash = priorHash ?? (await sha256File(localPath))
      if (size === expectedSize && priorHash && hash === priorHash) {
        skipped = true
      } else if (size === expectedSize && !priorHash) {
        skipped = true
      }
      if (skipped) {
        raw.size_bytes_actual = size
        raw.sha256 = hash
        raw.status = 'downloaded'
        raw.local_path = `tiles/${tileFilename(tileId)}`
        results.push({
          tile_id: tileId,
          status: 'skipped_existing',
          size_bytes: size,
          sha256: hash,
          skipped: true,
          duration_ms: Date.now() - tileStarted,
        })
        totalBytes += size
        continue
      }
    }

    const res = await runCommand('aws', [
      's3',
      'cp',
      s3Uri,
      localPath,
      '--no-sign-request',
    ])
    if (res.exitCode !== 0) {
      raw.status = 'failed'
      throw new Error(`Descarga fallida ${tileId}: ${res.stderr || res.stdout}`)
    }

    const size = statSync(localPath).size
    if (size !== expectedSize) {
      raw.status = 'failed'
      throw new Error(
        `Tamaño inesperado ${tileId}: esperado ${expectedSize}, obtenido ${size}`,
      )
    }

    const hash = await sha256File(localPath)
    raw.size_bytes_actual = size
    raw.sha256 = hash
    raw.status = 'downloaded'
    raw.downloaded_at = new Date().toISOString()
    raw.local_path = `tiles/${tileFilename(tileId)}`

    results.push({
      tile_id: tileId,
      status: 'downloaded',
      size_bytes: size,
      sha256: hash,
      skipped: false,
      duration_ms: Date.now() - tileStarted,
    })
    totalBytes += size
  }

  manifest.download_summary = {
    ...manifest.download_summary,
    total_bytes_actual: totalBytes,
    total_mb_actual: Math.round((totalBytes / 1024 / 1024) * 10) / 10,
    download_completed_at: new Date().toISOString(),
    download_duration_ms: Date.now() - started,
  }

  saveManifest(manifest)
  return {
    tiles: results,
    total_duration_ms: Date.now() - started,
    total_bytes: totalBytes,
  }
}
