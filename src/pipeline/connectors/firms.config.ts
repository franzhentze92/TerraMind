/** NASA FIRMS — configuración de ingesta para Guatemala (Sprint 1) */

export const FIRMS_FUENTE_ID = 'nasa-firms'
export const FIRMS_VARIABLE_ID = 'fire_radiative_power'

export const FIRMS_SOURCE = 'VIIRS_SNPP_NRT' as const

export const FIRMS_INGEST_SOURCES = [
  'VIIRS_SNPP_NRT',
  'VIIRS_NOAA20_NRT',
  'VIIRS_NOAA21_NRT',
  'MODIS_NRT',
] as const

/** @deprecated Use FIRMS_INGEST_SOURCES */
export const FIRMS_SOURCES = FIRMS_INGEST_SOURCES

export type FirmsSourceProduct = (typeof FIRMS_INGEST_SOURCES)[number]

/**
 * DAY_RANGE en la API ≠ "24hrs" del mapa web.
 * DAY_RANGE=1 → solo el día calendario actual (UTC) → suele devolver 0 al inicio del día.
 * DAY_RANGE=2 → hoy + ayer → se alinea mejor con la vista "24hrs" del mapa.
 */
export const FIRMS_DAY_RANGE = 2

/** Bounding box Guatemala: west,south,east,north */
export const GUATEMALA_BBOX = {
  west: -92.5,
  south: 13.5,
  east: -88.0,
  north: 18.0,
} as const

export const FIRMS_API_BASE = 'https://firms.modaps.eosdis.nasa.gov'
export const FIRMS_MAPKEY_STATUS_URL = `${FIRMS_API_BASE}/mapserver/mapkey_status/`

export function buildFirmsAreaCsvUrl(
  mapKey: string,
  source: FirmsSourceProduct = FIRMS_SOURCES[0],
): string {
  const { west, south, east, north } = GUATEMALA_BBOX
  const coords = `${west},${south},${east},${north}`
  return (
    `${FIRMS_API_BASE}/api/area/csv/${mapKey}/${source}/` +
    `${coords}/${FIRMS_DAY_RANGE}`
  )
}
