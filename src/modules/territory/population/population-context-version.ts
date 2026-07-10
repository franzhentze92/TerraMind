import { createHash } from 'node:crypto'

export const POPULATION_NODATA_POLICY = 'exclude-nodata-zero' as const
export const POPULATION_AREA_STRATEGY = 'laea-analytic-cog' as const
export const POPULATION_BUFFER_UNION_METHOD = 'ogr-st-union-laea-meters' as const
export const POPULATION_DEFAULT_BUFFER_RADII_M = [500, 1000, 3000, 5000] as const

export interface PopulationContextVersionInput {
  sourceCode: string
  sourceVersion: string
  productType: 'constrained' | 'unconstrained' | 'dual_use'
  rasterHash: string
  referenceYear: number
  analysisMethodVersion: string
  crs: string
  resamplingMethod: string
  zoneRadiiM: number[]
  nodataPolicy?: string
  areaStrategy?: string
  bufferUnionMethod?: string
  adjustmentMethod?: string
  settlementDatasetVersion?: string
}

export function buildPopulationContextVersion(
  input: PopulationContextVersionInput,
): string {
  const payload = [
    input.sourceCode,
    input.sourceVersion,
    input.productType,
    input.rasterHash,
    String(input.referenceYear),
    input.analysisMethodVersion,
    input.crs,
    input.resamplingMethod,
    [...input.zoneRadiiM].sort((a, b) => a - b).join(','),
    input.nodataPolicy ?? POPULATION_NODATA_POLICY,
    input.areaStrategy ?? POPULATION_AREA_STRATEGY,
    input.bufferUnionMethod ?? POPULATION_BUFFER_UNION_METHOD,
    input.adjustmentMethod ?? 'none',
    input.settlementDatasetVersion ?? 'none',
  ].join('|')
  return createHash('sha256').update(payload).digest('hex').slice(0, 16)
}
