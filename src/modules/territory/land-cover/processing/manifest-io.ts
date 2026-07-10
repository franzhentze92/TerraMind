import { createHash } from 'node:crypto'
import { createReadStream, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ESA_WORLDCOVER_SOURCE_DIR } from '@/modules/territory/land-cover/providers/esa-worldcover/esa-worldcover.manifest'

export const MANIFEST_SCRIPT_VERSION = 'land-cover-pipeline-v1' as const

export interface TileManifestEntry {
  tile_id: string
  s3_uri: string
  s3_key: string
  size_bytes_expected: number
  size_bytes_actual?: number
  sha256?: string
  status?: 'pending' | 'downloaded' | 'validated' | 'failed'
  downloaded_at?: string
  validated_at?: string
  local_path?: string
}

export interface LandCoverManifest {
  provider: string
  source_version: string
  reference_year: number
  tiles_required: Array<Record<string, unknown>>
  download_summary: Record<string, unknown>
  processing?: Record<string, unknown>
  artifacts?: Record<string, unknown>
  [key: string]: unknown
}

export function manifestPath(): string {
  return resolve(ESA_WORLDCOVER_SOURCE_DIR, 'manifest.json')
}

export function loadManifest(): LandCoverManifest {
  return JSON.parse(readFileSync(manifestPath(), 'utf8')) as LandCoverManifest
}

export function saveManifest(manifest: LandCoverManifest): void {
  writeFileSync(manifestPath(), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

export async function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

export function writeSha256Sums(entries: Array<{ path: string; sha256: string; label: string }>): void {
  const lines = entries.map((e) => `${e.sha256}  ${e.label}`)
  writeFileSync(resolve(ESA_WORLDCOVER_SOURCE_DIR, 'SHA256SUMS'), `${lines.join('\n')}\n`, 'utf8')
}
