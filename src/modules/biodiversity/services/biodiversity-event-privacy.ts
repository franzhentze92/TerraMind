import type { BiodiversityOccurrence } from '../biodiversity.types'
import {
  distanceFromAnalysisPointM,
  type BiodiversityAnalysisPoint,
} from './biodiversity-event-spatial'

export type BiodiversitySpatialPrivacyClass =
  | 'exact'
  | 'generalized'
  | 'obscured'
  | 'private'
  | 'sensitive'
  | 'unknown_precision'

export function classifySpatialPrivacy(occ: BiodiversityOccurrence): BiodiversitySpatialPrivacyClass {
  if (occ.privacyLevel === 'private_unavailable') return 'private'
  if (occ.geoprivacy?.toLowerCase() === 'private') return 'private'
  if (occ.coordinatesObscured || occ.geoprivacy?.toLowerCase() === 'obscured') return 'obscured'
  if (occ.privacyLevel === 'sensitive_generalized') return 'sensitive'
  if (occ.privacyLevel === 'public_generalized') return 'generalized'
  if (occ.privacyLevel === 'public_exact') return 'exact'
  return 'unknown_precision'
}

function effectiveUncertaintyM(occ: BiodiversityOccurrence): number {
  if (classifySpatialPrivacy(occ) === 'private') return Number.POSITIVE_INFINITY
  if (occ.coordinateUncertaintyM != null && Number.isFinite(occ.coordinateUncertaintyM)) {
    return occ.coordinateUncertaintyM
  }
  const privacy = classifySpatialPrivacy(occ)
  if (privacy === 'exact') return 0
  if (privacy === 'generalized') return 1000
  if (privacy === 'obscured' || privacy === 'sensitive') return 10_000
  return 10_000
}

export function isSpatiallyEligibleForRadius(
  occ: BiodiversityOccurrence,
  radiusM: number,
  analysisPoint: BiodiversityAnalysisPoint,
): boolean {
  if (classifySpatialPrivacy(occ) === 'private') {
    return false
  }

  if (effectiveUncertaintyM(occ) > radiusM) {
    return false
  }

  if (occ.latitude !== undefined && occ.longitude !== undefined) {
    const dist = distanceFromAnalysisPointM(
      analysisPoint,
      occ.latitude,
      occ.longitude,
    )
    if (dist > radiusM) return false
  }

  return true
}

export function buildRadiusEligibilityFlags(
  occ: BiodiversityOccurrence,
  radiiM: number[],
  analysisPoint: BiodiversityAnalysisPoint,
): Record<string, boolean> {
  const flags: Record<string, boolean> = {}
  for (const radiusM of radiiM) {
    flags[`eligible_for_${radiusM / 1000}km`] = isSpatiallyEligibleForRadius(
      occ,
      radiusM,
      analysisPoint,
    )
  }
  return flags
}

export function privacyStatusForApi(occ: BiodiversityOccurrence): string {
  return classifySpatialPrivacy(occ)
}
