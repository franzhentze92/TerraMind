/**
 * Manifiesto GHSL GHS-POP — respaldo / validación cruzada.
 * @see https://data.jrc.ec.europa.eu/dataset/2ff68a52-5b5b-4a22-8f40-c41da8332cfe
 */

export const GHSL_SOURCE_CODE = 'ghsl' as const

export const GHSL_DATASET_NAME = 'GHS-POP R2023A — GHS population grid multitemporal (1975-2030)' as const

export const GHSL_SOURCE_VERSION = 'R2023A' as const
export const GHSL_REFERENCE_YEAR = 2020 as const
export const GHSL_SPATIAL_RESOLUTION_M = 100 as const
export const GHSL_CRS_ANALYTIC = 'EPSG:54009' as const
export const GHSL_CRS_GEOGRAPHIC = 'EPSG:4326' as const
export const GHSL_ANALYSIS_METHOD_VERSION = 'zonal-sum-window-v1' as const

export const GHSL_LICENSE = 'EC-Reuse-with-attribution' as const
export const GHSL_ATTRIBUTION =
  'Schiavina M. et al. (2023). GHS-POP R2023A. doi:10.2905/2FF68A52-5B5B-4A22-8F40-C41DA8332CFE' as const

export const GHSL_POPULATION_TYPE = 'resident' as const
export const GHSL_MODEL_TYPE = 'gpw-disaggregated-built-up' as const
export const GHSL_UNIT = 'persons_per_cell' as const

export const GHSL_DOWNLOAD_URL =
  'https://data.jrc.ec.europa.eu/dataset/2ff68a52-5b5b-4a22-8f40-c41da8332cfe' as const

/** Recorte nacional estimado tras clip desde mosaico global. */
export const GHSL_GUATEMALA_CLIP_SIZE_BYTES_ESTIMATE = 35_000_000 as const
