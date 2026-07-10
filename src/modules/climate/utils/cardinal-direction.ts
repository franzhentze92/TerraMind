const CARDINALS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const

export type CardinalDirection = (typeof CARDINALS)[number]

/** Convierte grados meteorológicos (0=N, 90=E) a rosa de 16 puntos. */
export function degreesToCardinal(degrees: number | null | undefined): CardinalDirection | null {
  if (degrees === null || degrees === undefined || !Number.isFinite(degrees)) return null
  const normalized = ((degrees % 360) + 360) % 360
  const index = Math.round(normalized / 22.5) % 16
  return CARDINALS[index]
}

/** Dirección hacia la que se desplaza el viento (opuesta al origen meteorológico). */
export function windTowardCardinal(fromDegrees: number | null | undefined): CardinalDirection | null {
  if (fromDegrees === null || fromDegrees === undefined || !Number.isFinite(fromDegrees)) return null
  return degreesToCardinal((fromDegrees + 180) % 360)
}
