import type { InternalLandCoverClass } from '@/modules/territory/land-cover/land-cover.types'

export const ESA_WORLDCOVER_MAPPER_VERSION = 'esa-worldcover-v200-mapper-v1' as const

export interface EsaWorldCoverClassDef {
  code: number
  provider_name: string
  internal_class: InternalLandCoverClass
}

/** ESA WorldCover 2021 v200 — 11 clases + nodata (0). */
export const ESA_WORLDCOVER_V200_CLASSES: readonly EsaWorldCoverClassDef[] = [
  { code: 10, provider_name: 'Tree cover', internal_class: 'forest' },
  { code: 20, provider_name: 'Shrubland', internal_class: 'shrubland' },
  { code: 30, provider_name: 'Grassland', internal_class: 'grassland' },
  { code: 40, provider_name: 'Cropland', internal_class: 'cropland' },
  { code: 50, provider_name: 'Built-up', internal_class: 'built_up' },
  { code: 60, provider_name: 'Bare / sparse vegetation', internal_class: 'bare_sparse' },
  { code: 70, provider_name: 'Snow and ice', internal_class: 'snow_ice' },
  { code: 80, provider_name: 'Permanent water bodies', internal_class: 'permanent_water' },
  { code: 90, provider_name: 'Herbaceous wetland', internal_class: 'herbaceous_wetland' },
  { code: 95, provider_name: 'Mangroves', internal_class: 'mangrove' },
  { code: 100, provider_name: 'Moss and lichen', internal_class: 'moss_lichen' },
] as const

const CODE_MAP = new Map(
  ESA_WORLDCOVER_V200_CLASSES.map((c) => [c.code, c]),
)

export function mapEsaWorldCoverCode(code: number): EsaWorldCoverClassDef {
  return CODE_MAP.get(code) ?? {
    code,
    provider_name: 'Unknown',
    internal_class: 'unknown',
  }
}
