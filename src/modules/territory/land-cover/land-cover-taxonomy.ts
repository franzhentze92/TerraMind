import type { InternalLandCoverClass } from '@/modules/territory/land-cover/land-cover.types'

export const INTERNAL_LAND_COVER_CLASSES: readonly InternalLandCoverClass[] = [
  'forest',
  'shrubland',
  'grassland',
  'cropland',
  'built_up',
  'bare_sparse',
  'snow_ice',
  'permanent_water',
  'herbaceous_wetland',
  'mangrove',
  'moss_lichen',
  'unknown',
] as const

/** Etiquetas UI en español — cobertura clasificada, no uso legal. */
export const LAND_COVER_DISPLAY_LABELS: Record<InternalLandCoverClass, string> = {
  forest: 'Bosque',
  shrubland: 'Matorral',
  grassland: 'Pastizal',
  cropland: 'Cultivo',
  built_up: 'Área construida',
  bare_sparse: 'Suelo desnudo o vegetación escasa',
  snow_ice: 'Nieve o hielo',
  permanent_water: 'Agua permanente',
  herbaceous_wetland: 'Humedal herbáceo',
  mangrove: 'Manglar',
  moss_lichen: 'Musgos y líquenes',
  unknown: 'Sin clasificar',
}

export const LAND_COVER_TEMPORAL_DISCLAIMER =
  'Clasificación satelital de cobertura del suelo. No equivale a uso legal, tenencia ni verificación de campo.'

export const LAND_COVER_SNAPSHOT_DISCLAIMER =
  'Cobertura del suelo clasificada para el año de referencia del producto (ESA WorldCover 2021). No representa la condición actual del territorio.'

/** Disclaimer API/UI — producto 2021, sin afirmar daño ni uso legal. */
export const LAND_COVER_API_DISCLAIMER =
  'Clasificación satelital de cobertura del suelo correspondiente al año 2021. No equivale a uso legal, cobertura actual confirmada, superficie afectada ni verificación de campo.'

export function landCoverDisplayLabel(
  internalClass: string | null | undefined,
): string {
  if (!internalClass) return 'Sin clasificar'
  return (
    LAND_COVER_DISPLAY_LABELS[internalClass as InternalLandCoverClass] ?? 'Sin clasificar'
  )
}
