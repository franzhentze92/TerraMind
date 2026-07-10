import type { ClimateLocationType } from '../types/climate.types'

export function buildPointReferenceDisplayName(
  locationType: ClimateLocationType,
  entityName: string,
): string {
  if (locationType === 'country') {
    return `Punto de referencia nacional — centroide geográfico de ${entityName}`
  }
  if (locationType === 'department') {
    return `Punto de referencia departamental — centroide de ${entityName}`
  }
  return `Punto de referencia — ${entityName}`
}

export const SPATIAL_POINT_DISCLAIMER =
  'Este valor corresponde a un punto geográfico de referencia y no representa un promedio espacial del territorio.'

export const MODELLED_CONDITION_LABEL =
  'Condición meteorológica modelada más reciente (no medición de estación).'
