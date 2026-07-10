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

/** Etiquetas UI en español — cobertura, no uso legal. */
export const LAND_COVER_DISPLAY_LABELS: Record<InternalLandCoverClass, string> = {
  forest: 'Bosque',
  shrubland: 'Arbustal',
  grassland: 'Pastizal',
  cropland: 'Cultivo',
  built_up: 'Urbano / construido',
  bare_sparse: 'Suelo desnudo / escaso',
  snow_ice: 'Nieve / hielo',
  permanent_water: 'Agua permanente',
  herbaceous_wetland: 'Humedal herbáceo',
  mangrove: 'Manglar',
  moss_lichen: 'Musgo / líquen',
  unknown: 'Desconocido',
}

export const LAND_COVER_TEMPORAL_DISCLAIMER =
  'Clasificación satelital de cobertura del suelo. No equivale a uso legal, tenencia ni verificación de campo.'

export const LAND_COVER_SNAPSHOT_DISCLAIMER =
  'Cobertura del suelo clasificada para el año de referencia del producto (ESA WorldCover 2021). No representa la condición actual del territorio.'
