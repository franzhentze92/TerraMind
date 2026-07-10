import { createHash } from 'node:crypto'

export const LAND_COVER_NODATA_POLICY = 'exclude-zero' as const
export const LAND_COVER_AREA_STRATEGY = 'laea-analytic-cog' as const
export const LAND_COVER_BUFFER_UNION_METHOD = 'ogr-st-union-laea-meters' as const

export interface LandCoverContextVersionInput {
  sourceVersion: string
  rasterHash: string
  mapperVersion: string
  analysisMethodVersion: string
  zoneRadiiM: number[]
  nodataPolicy?: string
  areaStrategy?: string
  bufferUnionMethod?: string
}

export function buildLandCoverContextVersion(
  input: LandCoverContextVersionInput,
): string {
  const payload = [
    input.sourceVersion,
    input.rasterHash,
    input.mapperVersion,
    input.analysisMethodVersion,
    [...input.zoneRadiiM].sort((a, b) => a - b).join(','),
    input.nodataPolicy ?? LAND_COVER_NODATA_POLICY,
    input.areaStrategy ?? LAND_COVER_AREA_STRATEGY,
    input.bufferUnionMethod ?? LAND_COVER_BUFFER_UNION_METHOD,
  ].join('|')
  return createHash('sha256').update(payload).digest('hex').slice(0, 16)
}
