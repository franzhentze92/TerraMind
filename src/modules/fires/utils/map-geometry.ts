import { GUATEMALA_MAP_BOUNDS, GUATEMALA_FIT_PADDING } from './map-styles'

export type FitBoundsPadding = [number, number]

/** Opciones equivalentes a Leaflet fitBounds para vista nacional. */
export function nationalMapFitOptions(padding: FitBoundsPadding = GUATEMALA_FIT_PADDING) {
  return {
    bounds: GUATEMALA_MAP_BOUNDS,
    padding,
  }
}

/** Centro aproximado del país (útil para marcadores de prueba). */
export function guatemalaBoundsCenter(): [number, number] {
  const [[south, west], [north, east]] = GUATEMALA_MAP_BOUNDS
  return [(south + north) / 2, (west + east) / 2]
}
