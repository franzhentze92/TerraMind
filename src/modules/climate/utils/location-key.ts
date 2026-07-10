import type { ClimateLocationType } from '../types/climate.types'

const COORD_DECIMALS = 3

/** Clave determinística para evitar ubicaciones duplicadas con coordenadas casi iguales. */
export function buildCoordinateLocationKey(
  locationType: ClimateLocationType,
  latitude: number,
  longitude: number,
): string {
  const lat = latitude.toFixed(COORD_DECIMALS)
  const lng = longitude.toFixed(COORD_DECIMALS)
  return `${locationType}:coord:${lat},${lng}`
}

export function buildEntityLocationKey(
  locationType: ClimateLocationType,
  relatedEntityType: string,
  relatedEntityId: string,
): string {
  return `${locationType}:${relatedEntityType}:${relatedEntityId}`
}

export function buildCountryLocationKey(countryCode: string): string {
  return buildEntityLocationKey('country', 'geo_countries', countryCode.toUpperCase())
}

export function buildDepartmentLocationKey(countryCode: string, departmentCode: string): string {
  return buildEntityLocationKey(
    'department',
    'geo_departments',
    `${countryCode.toUpperCase()}:${departmentCode}`,
  )
}
