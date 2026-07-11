/**
 * CHIRPS v3 — official URLs and product constants.
 *
 * Source: Climate Hazards Center (UC Santa Barbara).
 * https://www.chc.ucsb.edu/data/chirps3
 */
export const CHIRPS_V3_BASE = 'https://data.chc.ucsb.edu/products/CHIRPS/v3.0'

export const CHIRPS_V3_SOURCE_VERSION = '3.0'

export const CHIRPS_V3_PROCESSING_VERSION = 'rainfall-deficit-mvp-1'

/** Guatemala subset — smaller downloads than global. */
export const CHIRPS_V3_REGION = 'latam' as const

export const CHIRPS_V3_GRID_RESOLUTION_DEG = 0.05

export const CHIRPS_V3_CITATION =
  'Climate Hazards Center Infrared Precipitation with Stations version 3 (CHIRPS3). https://doi.org/10.15780/G2JQ0P'

export const CHIRPS_V3_BASELINE_START = 1991
export const CHIRPS_V3_BASELINE_END = 2020

export const CHIRPS_V3_MIN_HISTORY_YEARS = 20

/** Bounding box Guatemala (W,S,E,N) for clipping. */
export const GUATEMALA_BBOX: [number, number, number, number] = [-92.35, 13.63, -88.17, 17.82]

export const CHIRPS_PRELIM_MIN_YEAR = 2025
