import type { BiodiversityOccurrence, BiodiversityPrivacyLevel } from './biodiversity.types'

const GENERALIZE_DECIMALS = 2

function generalizeCoordinate(value: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  const factor = 10 ** GENERALIZE_DECIMALS
  return Math.round(n * factor) / factor
}

function isSensitiveGeoprivacy(geoprivacy?: string): boolean {
  if (!geoprivacy) return false
  const g = geoprivacy.toLowerCase()
  return g === 'obscured' || g === 'private' || g === 'taxon_obscured'
}

/**
 * Aplica política de privacidad sin reconstruir coordenadas ocultas.
 * No presenta precisión falsa ni expone ubicación exacta de especies sensibles.
 */
export function applyBiodiversityPrivacyPolicy(
  occurrence: BiodiversityOccurrence,
): BiodiversityOccurrence {
  const next = { ...occurrence }

  if (next.geoprivacy?.toLowerCase() === 'private' || next.privacyLevel === 'private_unavailable') {
    next.privacyLevel = 'private_unavailable'
    next.latitude = undefined
    next.longitude = undefined
    next.coordinateUncertaintyM = undefined
    next.qualityWarnings = [...next.qualityWarnings, 'location_withheld']
    return next
  }

  if (next.coordinatesObscured || isSensitiveGeoprivacy(next.geoprivacy)) {
    if (next.latitude !== undefined && next.longitude !== undefined) {
      next.latitude = generalizeCoordinate(next.latitude)
      next.longitude = generalizeCoordinate(next.longitude)
      next.coordinateUncertaintyM = Math.max(next.coordinateUncertaintyM ?? 0, 10_000)
    }
    next.privacyLevel = 'sensitive_generalized'
    next.qualityWarnings = [...next.qualityWarnings, 'coordinates_generalized']
    return next
  }

  if (next.latitude !== undefined && next.longitude !== undefined) {
    next.privacyLevel = 'public_exact'
    return next
  }

  next.privacyLevel = 'private_unavailable'
  return next
}

export function canExposeExactLocation(level: BiodiversityPrivacyLevel): boolean {
  return level === 'public_exact'
}
