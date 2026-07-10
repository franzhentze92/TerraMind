/**
 * Manifiesto INE Guatemala — capa administrativa oficial.
 * @see https://censo2018.ine.gob.gt/
 */

export const INE_SOURCE_CODE = 'ine_guatemala' as const

export const INE_DATASET_NAME =
  'XII Censo Nacional de Población y VII de Vivienda 2018' as const

export const INE_SOURCE_VERSION = 'censo-2018' as const
export const INE_REFERENCE_YEAR = 2018 as const
export const INE_LICENSE = 'public-institutional' as const
export const INE_ATTRIBUTION = 'INE Guatemala, XII Censo Nacional de Población y VII de Vivienda 2018' as const

/** Total nacional publicado (censo 2018). */
export const INE_NATIONAL_POPULATION_2018 = 14_901_286 as const
export const INE_DEPARTMENT_COUNT = 22 as const
export const INE_MUNICIPALITY_COUNT = 340 as const
export const INE_SETTLEMENT_COUNT_APPROX = 20_254 as const

export const INE_DOWNLOAD_URLS = {
  censusPortal: 'https://censo2018.ine.gob.gt/',
  openData: 'https://datos.ine.gob.gt/dataset/censo-2018-lugares-poblados',
  projections: 'https://www.ine.gob.gt/censo-poblacion/',
} as const

/** Muestras públicas para PoC / validación (no microdatos). */
export const INE_REFERENCE_TOTALS = {
  guatemala_municipality_2018: 993_825,
  champerico_municipality_2018: 38_566,
  peten_department_2018: 626_307,
} as const
