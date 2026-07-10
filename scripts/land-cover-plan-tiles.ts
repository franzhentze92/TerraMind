/**
 * Planificación de tiles ESA WorldCover para Guatemala — sin descarga.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const GUATEMALA_BBOX = {
  min_lon: -92.240242471,
  max_lon: -88.221497532,
  min_lat: 13.739443412,
  max_lat: 17.819453371,
}

function tilesForBbox(bbox: typeof GUATEMALA_BBOX): string[] {
  const ids: string[] = []
  for (let lat = Math.floor(bbox.min_lat / 3) * 3; lat <= Math.floor(bbox.max_lat / 3) * 3; lat += 3) {
    for (let lon = Math.ceil(-bbox.max_lon / 3) * 3; lon <= Math.ceil(-bbox.min_lon / 3) * 3; lon += 3) {
      const latStr = `N${String(lat).padStart(2, '0')}`
      const lonStr = `W${String(lon).padStart(3, '0')}`
      ids.push(`${latStr}${lonStr}`)
    }
  }
  return ids
}

async function main() {
  const manifestPath = resolve(
    process.cwd(),
    'data/geo/sources/land-cover/esa-worldcover/2021-v200/manifest.json',
  )
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    tiles_required: Array<{ tile_id: string; size_bytes: number; s3_uri: string }>
    download_summary: { total_mb: number; tile_count: number }
  }

  const computed = tilesForBbox(GUATEMALA_BBOX)

  console.log('🗺️  Planificación tiles — ESA WorldCover 2021 v200 (Guatemala)')
  console.log('\nBBox WGS84:', GUATEMALA_BBOX)
  console.log('\nTile IDs calculados:', computed.join(', '))
  console.log('\nTiles en manifest (verificados S3):')
  for (const t of manifest.tiles_required) {
    console.log(`  ${t.tile_id}\t${(t.size_bytes / 1024 / 1024).toFixed(1)} MB\t${t.s3_uri}`)
  }
  console.log(
    `\nTotal descarga: ${manifest.download_summary.total_mb} MB (${manifest.download_summary.tile_count} tiles)`,
  )
  console.log('\n⚠️  Descarga NO iniciada. Aprobar explícitamente antes de Commit 7A.2-B.')
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err)
  process.exit(1)
})
