import { resolve } from 'node:path'

import {
  GUATEMALA_ADM0_GEOJSON,
  GUATEMALA_BOUNDARY_AREA_SQKM_PROPERTY,
  LAEA_PROJ4,
} from '@/modules/territory/land-cover/processing/paths'

export const POPULATION_WORLDPOP_SOURCE_DIR = resolve(
  process.cwd(),
  'data/population/worldpop',
)

export const POPULATION_RAW_DIR = resolve(POPULATION_WORLDPOP_SOURCE_DIR, 'raw')
export const POPULATION_PROCESSED_DIR = resolve(POPULATION_WORLDPOP_SOURCE_DIR, 'processed')
export const POPULATION_REPORTS_DIR = resolve(POPULATION_WORLDPOP_SOURCE_DIR, 'reports')
export const POPULATION_MANIFEST_PATH = resolve(POPULATION_WORLDPOP_SOURCE_DIR, 'manifest.json')
export const POPULATION_SOURCE_MD = resolve(POPULATION_WORLDPOP_SOURCE_DIR, 'SOURCE.md')
export const POPULATION_SHA256SUMS = resolve(POPULATION_WORLDPOP_SOURCE_DIR, 'SHA256SUMS')
export const POPULATION_CLIP_TEMP_DIR = resolve(POPULATION_PROCESSED_DIR, '_clip_temp')
export const POPULATION_AUDIT_REPORT = resolve(
  process.cwd(),
  'docs/reports/POPULATION-WORLDPOP-2020-AUDIT.md',
)

export const GUATEMALA_ADM1_GEOJSON = resolve(
  process.cwd(),
  'data/geo/sources/hdx-cod-ab-guatemala/2025-10-30-v01/extracted/gtm_admin1.geojson',
)

export {
  GUATEMALA_ADM0_GEOJSON,
  GUATEMALA_BOUNDARY_AREA_SQKM_PROPERTY,
  LAEA_PROJ4,
}

/** Tolerancia LAEA — unconstrained legacy puede diferir más por alineación de grilla. */
export const POPULATION_SUM_TOLERANCE_PCT: Record<'constrained' | 'unconstrained', number> = {
  constrained: 0.5,
  unconstrained: 1.5,
} as const

export function rawRasterPath(variant: 'constrained' | 'unconstrained'): string {
  return resolve(
    POPULATION_RAW_DIR,
    variant === 'constrained'
      ? 'gtm_pop_2020_cn_100m_constrained.tif'
      : 'gtm_ppp_2020_unconstrained.tif',
  )
}

export function processedWgs84Cog(variant: 'constrained' | 'unconstrained'): string {
  return resolve(
    POPULATION_PROCESSED_DIR,
    variant === 'constrained'
      ? 'gtm_worldpop_2020_constrained_wgs84_cog.tif'
      : 'gtm_worldpop_2020_unconstrained_wgs84_cog.tif',
  )
}

export function processedLaeaCog(variant: 'constrained' | 'unconstrained'): string {
  return resolve(
    POPULATION_PROCESSED_DIR,
    variant === 'constrained'
      ? 'gtm_worldpop_2020_constrained_laea_cog.tif'
      : 'gtm_worldpop_2020_unconstrained_laea_cog.tif',
  )
}
