import { createHash } from 'node:crypto'
import { createReadStream, readFileSync, writeFileSync } from 'node:fs'

import { POPULATION_MANIFEST_PATH } from '@/modules/territory/population/processing/paths'

export const POPULATION_MANIFEST_VERSION = 'population-pipeline-v1' as const

export interface PopulationDownloadEntry {
  variant: 'constrained' | 'unconstrained'
  official_url: string
  local_path: string
  expected_size_bytes: number
  size_bytes_actual?: number
  sha256?: string
  downloaded_at?: string
  status: 'pending' | 'downloaded' | 'validated' | 'failed'
}

export interface PopulationConservationEntry {
  variant: 'constrained' | 'unconstrained'
  raw_sum: number
  wgs84_clip_sum: number
  wgs84_cog_sum: number
  laea_cog_sum: number
  diff_wgs84_clip_pct: number
  diff_laea_pct: number
  outside_adm0_population: number
  nodata_inside_adm0_pixels: number
}

export interface PopulationManifest {
  manifest_version: string
  reference_year: number
  downloads: PopulationDownloadEntry[]
  conservation?: PopulationConservationEntry[]
  artifacts?: Record<string, unknown>
  audit?: Record<string, unknown>
  benchmark?: Record<string, unknown>
  recommended_primary_variant?: 'constrained' | 'unconstrained' | 'dual_use'
  adjustment_policy?: string
  [key: string]: unknown
}

export function loadPopulationManifest(): PopulationManifest {
  return JSON.parse(readFileSync(POPULATION_MANIFEST_PATH, 'utf8')) as PopulationManifest
}

export function savePopulationManifest(manifest: PopulationManifest): void {
  writeFileSync(POPULATION_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
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

export function writeSha256Sums(
  entries: Array<{ path: string; sha256: string; label: string }>,
  outputPath: string,
): void {
  const lines = entries.map((e) => `${e.sha256}  ${e.label}`)
  writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8')
}
