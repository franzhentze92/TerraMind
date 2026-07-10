import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const ESA_WORLDCOVER_SOURCE_DIR = resolve(
  process.cwd(),
  'data/geo/sources/land-cover/esa-worldcover/2021-v200',
)

export const ESA_WORLDCOVER_LAYER_CODE = 'gt_land_cover' as const
export const ESA_WORLDCOVER_SOURCE_VERSION = '2021-v200' as const
export const ESA_WORLDCOVER_REFERENCE_YEAR = 2021
export const ESA_WORLDCOVER_ANALYSIS_METHOD_VERSION = 'laea-zone-stats-v1' as const

export { buildLandCoverContextVersion } from '@/modules/territory/land-cover/land-cover-context-version'

export interface EsaWorldCoverManifest {
  provider: string
  source_version: string
  reference_year: number
  mapper_version: string
  analysis_method_version: string
  tiles_required: Array<{ tile_id: string; size_bytes: number; s3_uri: string }>
  download_summary: { tile_count: number; total_bytes: number }
}

export function loadEsaWorldCoverManifest(): EsaWorldCoverManifest {
  const path = resolve(ESA_WORLDCOVER_SOURCE_DIR, 'manifest.json')
  return JSON.parse(readFileSync(path, 'utf8')) as EsaWorldCoverManifest
}
