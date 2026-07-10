import { resolve } from 'node:path'
import { ESA_WORLDCOVER_SOURCE_DIR } from '@/modules/territory/land-cover/providers/esa-worldcover/esa-worldcover.manifest'

export const LAND_COVER_TILES_DIR = resolve(ESA_WORLDCOVER_SOURCE_DIR, 'tiles')
export const LAND_COVER_PROCESSED_DIR = resolve(ESA_WORLDCOVER_SOURCE_DIR, 'processed')
export const LAND_COVER_SOURCE_COG = resolve(LAND_COVER_PROCESSED_DIR, 'land_cover_gt_4326.tif')
export const LAND_COVER_ANALYTIC_COG = resolve(LAND_COVER_PROCESSED_DIR, 'land_cover_gt_laea.tif')
export const LAND_COVER_MOSAIC_VRT = resolve(LAND_COVER_PROCESSED_DIR, '_mosaic.vrt')
export const LAND_COVER_CLIP_TEMP = resolve(LAND_COVER_PROCESSED_DIR, '_clip_4326.tif')
export const LAND_COVER_SHA256SUMS = resolve(ESA_WORLDCOVER_SOURCE_DIR, 'SHA256SUMS')

export const GUATEMALA_ADM0_GEOJSON = resolve(
  process.cwd(),
  'data/geo/sources/hdx-cod-ab-guatemala/2025-10-30-v01/extracted/gtm_admin0.geojson',
)

/** Área de referencia derivada del boundary operativo HDX (no usar 108,889 km²). */
export const GUATEMALA_BOUNDARY_AREA_SQKM_PROPERTY = 'area_sqkm' as const

export const LAEA_PROJ4 =
  '+proj=laea +lat_0=15.779 +lon_0=-90.231 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs'

export const LAND_COVER_TEMP_DIR_PREFIX = 'terramind-land-cover-'
