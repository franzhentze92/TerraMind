export interface GuatemalaRegion {
  id: string
  name: string
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

/** Bounding boxes aproximados para departamentos de Guatemala */
export const GUATEMALA_REGIONS: GuatemalaRegion[] = [
  { id: 'gt-peten', name: 'Petén', minLat: 15.8, maxLat: 17.8, minLng: -92.3, maxLng: -89.0 },
  { id: 'gt-alta-verapaz', name: 'Alta Verapaz', minLat: 15.0, maxLat: 16.2, minLng: -90.8, maxLng: -89.5 },
  { id: 'gt-izabal', name: 'Izabal', minLat: 15.2, maxLat: 16.0, minLng: -89.5, maxLng: -88.2 },
  { id: 'gt-huehuetenango', name: 'Huehuetenango', minLat: 15.2, maxLat: 16.2, minLng: -92.0, maxLng: -90.5 },
  { id: 'gt-quiche', name: 'Quiché', minLat: 14.8, maxLat: 16.0, minLng: -91.5, maxLng: -90.2 },
  { id: 'gt-solola', name: 'Sololá', minLat: 14.5, maxLat: 15.2, minLng: -91.5, maxLng: -90.8 },
  { id: 'gt-escuintla', name: 'Escuintla', minLat: 13.8, maxLat: 14.5, minLng: -91.2, maxLng: -90.5 },
  { id: 'gt-santa-rosa', name: 'Santa Rosa', minLat: 13.8, maxLat: 14.5, minLng: -90.5, maxLng: -89.8 },
  { id: 'gt-jutiapa', name: 'Jutiapa', minLat: 14.0, maxLat: 14.6, minLng: -90.2, maxLng: -89.5 },
]

export function resolveRegion(lat: number, lng: number): GuatemalaRegion {
  for (const region of GUATEMALA_REGIONS) {
    if (
      lat >= region.minLat &&
      lat <= region.maxLat &&
      lng >= region.minLng &&
      lng <= region.maxLng
    ) {
      return region
    }
  }
  return {
    id: 'gt-nacional',
    name: 'Guatemala',
    minLat: 13.7,
    maxLat: 17.8,
    minLng: -92.3,
    maxLng: -88.2,
  }
}
