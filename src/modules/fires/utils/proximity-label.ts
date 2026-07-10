export type ProximityLabel =
  | 'dentro'
  | 'muy_cerca'
  | 'cerca'
  | 'entorno_proximo'
  | 'distante'

export const PROXIMITY_THRESHOLDS_M = {
  muy_cerca: 1000,
  cerca: 5000,
  entorno_proximo: 10000,
} as const

export function computeProximityLabel(
  distanceM: number | null | undefined,
  insideProtectedArea: boolean | null | undefined,
): ProximityLabel {
  if (insideProtectedArea) return 'dentro'
  if (distanceM == null || !Number.isFinite(distanceM)) return 'distante'
  if (distanceM <= PROXIMITY_THRESHOLDS_M.muy_cerca) return 'muy_cerca'
  if (distanceM <= PROXIMITY_THRESHOLDS_M.cerca) return 'cerca'
  if (distanceM <= PROXIMITY_THRESHOLDS_M.entorno_proximo) return 'entorno_proximo'
  return 'distante'
}

export function proximityLabelText(label: ProximityLabel): string {
  switch (label) {
    case 'dentro':
      return 'Dentro'
    case 'muy_cerca':
      return 'Muy cerca (≤ 1 km)'
    case 'cerca':
      return 'Cerca (≤ 5 km)'
    case 'entorno_proximo':
      return 'Entorno próximo (≤ 10 km)'
    case 'distante':
      return 'Distante (> 10 km)'
  }
}

export function formatDistanceM(distanceM: number | null | undefined): string {
  if (distanceM == null || !Number.isFinite(distanceM)) return '—'
  if (distanceM < 1000) return `${Math.round(distanceM)} m`
  return `${(distanceM / 1000).toFixed(1)} km`
}
