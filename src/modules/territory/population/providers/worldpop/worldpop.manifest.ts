/**
 * Manifiesto WorldPop — capa espacial modelada (Guatemala).
 * @see https://data.humdata.org/dataset/worldpop-population-counts-2015-2030-gtm
 */

export const WORLDPOP_SOURCE_CODE = 'worldpop' as const

export const WORLDPOP_DATASET_NAME =
  'Constrained individual countries 2015-2030 (100m resolution)' as const

export const WORLDPOP_SOURCE_VERSION = 'R2025A-v1' as const
export const WORLDPOP_REFERENCE_YEAR = 2020 as const
export const WORLDPOP_SPATIAL_RESOLUTION_M = 100 as const
export const WORLDPOP_CRS = 'EPSG:4326' as const
export const WORLDPOP_ANALYSIS_METHOD_VERSION = 'zonal-sum-window-v1' as const

export const WORLDPOP_PRIMARY_FILE = 'gtm_pop_2020_cn_100m.tif' as const
export const WORLDPOP_PRIMARY_FILE_SIZE_BYTES = 16_200_000 as const
export const WORLDPOP_LICENSE = 'CC-BY-4.0' as const
export const WORLDPOP_ATTRIBUTION =
  'Bondarenko M. et al. (2025). WorldPop constrained population counts Guatemala. DOI:10.5258/SOTON/WP00839' as const

export const WORLDPOP_POPULATION_TYPE = 'resident' as const
export const WORLDPOP_MODEL_TYPE = 'constrained' as const
export const WORLDPOP_UNIT = 'persons_per_pixel' as const

export const WORLDPOP_DOWNLOAD_URLS = {
  hdx2020: 'https://data.humdata.org/dataset/worldpop-population-counts-2015-2030-gtm',
  hub: 'https://hub.worldpop.org/geodata/listing?id=52195',
} as const
