import type { FirmsSourceProduct } from '@/pipeline/connectors/firms.config'

const SOURCE_DISPLAY: Record<FirmsSourceProduct, string> = {
  VIIRS_SNPP_NRT: 'VIIRS S-NPP',
  VIIRS_NOAA20_NRT: 'VIIRS NOAA-20',
  VIIRS_NOAA21_NRT: 'VIIRS NOAA-21',
  MODIS_NRT: 'MODIS',
}

const SATELLITE_DISPLAY: Record<string, string> = {
  N: 'Suomi NPP',
  N20: 'NOAA-20',
  N21: 'NOAA-21',
  A: 'Aqua',
  T: 'Terra',
}

export function sourceProductDisplayName(source: string): string {
  return SOURCE_DISPLAY[source as FirmsSourceProduct] ?? source
}

export function satelliteDisplayName(satellite: string | null): string {
  if (!satellite) return '—'
  return SATELLITE_DISPLAY[satellite] ?? satellite
}
