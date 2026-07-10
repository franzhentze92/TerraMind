import type { InternalLandCoverClass } from '@/modules/territory/land-cover/land-cover.types'

/** Paleta sobria para barras de distribución — cobertura clasificada, no uso del suelo. */
export const LAND_COVER_CLASS_COLORS: Record<InternalLandCoverClass, string> = {
  forest: '#1b5e20',
  shrubland: '#6b8e23',
  grassland: '#9ccc65',
  cropland: '#f9a825',
  built_up: '#b71c1c',
  bare_sparse: '#d7ccc8',
  permanent_water: '#1565c0',
  herbaceous_wetland: '#00838f',
  mangrove: '#00695c',
  snow_ice: '#eceff1',
  moss_lichen: '#a1887f',
  unknown: '#9e9e9e',
}

export const LAND_COVER_OTHERS_COLOR = '#bdbdbd'

export function landCoverClassColor(internalClass: string): string {
  return (
    LAND_COVER_CLASS_COLORS[internalClass as InternalLandCoverClass] ??
    LAND_COVER_OTHERS_COLOR
  )
}
