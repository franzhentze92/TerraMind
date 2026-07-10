/**
 * Productos WorldPop Guatemala 2020 — URLs oficiales data.worldpop.org (vía HDX API / Hub).
 */

export type WorldPopVariant = 'constrained' | 'unconstrained'

export interface WorldPopProductDefinition {
  variant: WorldPopVariant
  referenceYear: 2020
  localFilename: string
  officialUrl: string
  hubListingId: number
  sourceVersion: string
  expectedSizeBytes: number
  modelType: 'constrained' | 'unconstrained'
  unit: 'persons_per_pixel'
  crs: 'EPSG:4326'
  license: string
  doi: string
  attribution: string
}

export const WORLDPOP_CONSTRAINED_2020: WorldPopProductDefinition = {
  variant: 'constrained',
  referenceYear: 2020,
  localFilename: 'gtm_pop_2020_cn_100m_constrained.tif',
  officialUrl:
    'https://data.worldpop.org/GIS/Population/Global_2015_2030/R2025A/2020/GTM/v1/100m/constrained/gtm_pop_2020_CN_100m_R2025A_v1.tif',
  hubListingId: 52195,
  sourceVersion: 'R2025A-v1',
  expectedSizeBytes: 17_033_231,
  modelType: 'constrained',
  unit: 'persons_per_pixel',
  crs: 'EPSG:4326',
  license: 'CC-BY-4.0',
  doi: '10.5258/SOTON/WP00839',
  attribution:
    'Bondarenko M. et al. (2025). WorldPop constrained population Guatemala R2025A. DOI:10.5258/SOTON/WP00839',
}

export const WORLDPOP_UNCONSTRAINED_2020: WorldPopProductDefinition = {
  variant: 'unconstrained',
  referenceYear: 2020,
  localFilename: 'gtm_ppp_2020_unconstrained.tif',
  officialUrl:
    'https://data.worldpop.org/GIS/Population/Global_2000_2020/2020/GTM/gtm_ppp_2020.tif',
  hubListingId: 6370,
  sourceVersion: 'Global_2000_2020',
  expectedSizeBytes: 60_271_574,
  modelType: 'unconstrained',
  unit: 'persons_per_pixel',
  crs: 'EPSG:4326',
  license: 'CC-BY-4.0',
  doi: '10.5258/SOTON/WP00645',
  attribution:
    'WorldPop & CIESIN (2018). Global High Resolution Population Denominators. DOI:10.5258/SOTON/WP00645',
}

export const WORLDPOP_PRODUCTS_2020: readonly WorldPopProductDefinition[] = [
  WORLDPOP_CONSTRAINED_2020,
  WORLDPOP_UNCONSTRAINED_2020,
] as const

export function getWorldPopProduct(variant: WorldPopVariant): WorldPopProductDefinition {
  return variant === 'constrained' ? WORLDPOP_CONSTRAINED_2020 : WORLDPOP_UNCONSTRAINED_2020
}
