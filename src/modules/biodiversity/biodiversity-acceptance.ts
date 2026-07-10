import type { BiodiversityOccurrence } from './biodiversity.types'

export interface AcceptanceResult {
  accepted: BiodiversityOccurrence[]
  rejected: Array<{ occurrence: BiodiversityOccurrence; reason: string }>
}

/** Criterios de aceptación post-normalización para consultas en vivo. */
export function partitionAcceptedOccurrences(
  occurrences: BiodiversityOccurrence[],
  options: { requireCoordinates?: boolean } = {},
): AcceptanceResult {
  const requireCoordinates = options.requireCoordinates !== false
  const accepted: BiodiversityOccurrence[] = []
  const rejected: AcceptanceResult['rejected'] = []

  for (const occ of occurrences) {
    if (!occ.scientificName || occ.scientificName === 'Unknown') {
      rejected.push({ occurrence: occ, reason: 'unresolved_taxon' })
      continue
    }
    if (requireCoordinates && occ.privacyLevel !== 'private_unavailable') {
      if (occ.latitude === undefined || occ.longitude === undefined) {
        rejected.push({ occurrence: occ, reason: 'missing_coordinates' })
        continue
      }
    }
    accepted.push(occ)
  }

  return { accepted, rejected }
}

export function countUnresolvedTaxa(occurrences: BiodiversityOccurrence[]): number {
  return occurrences.filter((o) => !o.scientificName || o.scientificName === 'Unknown').length
}
