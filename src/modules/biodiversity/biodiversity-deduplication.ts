import { createHash } from 'node:crypto'
import type { BiodiversityOccurrence } from './biodiversity.types'
import {
  detectGbifInaturalistProvenance,
  extractInaturalistIdFromReferences,
} from './biodiversity-gbif-inaturalist-provenance'

export type DeduplicationConfidence = 'exact' | 'high' | 'medium' | 'low'

export type DeduplicationReason =
  | 'shared_inaturalist_observation_id'
  | 'occurrence_id_match'
  | 'inat_url_in_gbif'
  | 'source_reference_match'
  | 'probable_cross_source'
  | 'similar_unverified'

const COORD_TOLERANCE_DEG = 0.05

function buildGroupId(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16)
}

function dateKey(iso?: string): string | null {
  if (!iso) return null
  if (iso.length < 10) return null
  return iso.slice(0, 10)
}

function hasPreciseDate(occ: BiodiversityOccurrence): boolean {
  const precision = occ.eventDatePrecision
  if (precision === 'year' || precision === 'month') return false
  return dateKey(occ.observedAt) !== null
}

function shouldSkipCoordinateDedup(occ: BiodiversityOccurrence): boolean {
  return (
    occ.coordinatesObscured ||
    occ.privacyLevel === 'private_unavailable' ||
    occ.privacyLevel === 'sensitive_generalized'
  )
}

function coordsWithinTolerance(a: BiodiversityOccurrence, b: BiodiversityOccurrence): boolean {
  if (a.latitude === undefined || a.longitude === undefined) return false
  if (b.latitude === undefined || b.longitude === undefined) return false
  return (
    Math.abs(a.latitude - b.latitude) <= COORD_TOLERANCE_DEG &&
    Math.abs(a.longitude - b.longitude) <= COORD_TOLERANCE_DEG
  )
}

function occurrenceKey(occ: BiodiversityOccurrence): string {
  return `${occ.source}:${occ.sourceOccurrenceId}`
}

interface MatchResult {
  confidence: DeduplicationConfidence
  reason: DeduplicationReason
  groupId?: string
  candidateOnly: boolean
}

function resolveInatIdFromGbif(gbif: BiodiversityOccurrence): string | null {
  const provenance = detectGbifInaturalistProvenance(gbif)
  if (provenance.inaturalistObservationId) return provenance.inaturalistObservationId
  return extractInaturalistIdFromReferences(gbif.sourceUrl)
}

function evaluateGbifInatPair(gbif: BiodiversityOccurrence, inat: BiodiversityOccurrence): MatchResult | null {
  const inatIdFromGbif = resolveInatIdFromGbif(gbif)

  if (inatIdFromGbif && inatIdFromGbif === inat.sourceOccurrenceId) {
    return {
      confidence: 'exact',
      reason: 'shared_inaturalist_observation_id',
      groupId: buildGroupId(['inat-id', inatIdFromGbif]),
      candidateOnly: false,
    }
  }

  if (
    gbif.dwcOccurrenceId &&
    (gbif.dwcOccurrenceId === inat.sourceOccurrenceId || gbif.dwcOccurrenceId === inat.dwcOccurrenceId)
  ) {
    return {
      confidence: 'exact',
      reason: 'occurrence_id_match',
      groupId: buildGroupId(['occ-id', gbif.dwcOccurrenceId, inat.sourceOccurrenceId]),
      candidateOnly: false,
    }
  }

  if (extractInaturalistIdFromReferences(gbif.sourceReference) === inat.sourceOccurrenceId) {
    return {
      confidence: 'high',
      reason: 'source_reference_match',
      groupId: buildGroupId(['source-ref', inat.sourceOccurrenceId]),
      candidateOnly: false,
    }
  }

  const urlId = extractInaturalistIdFromReferences(gbif.sourceUrl)
  if (urlId && urlId === inat.sourceOccurrenceId) {
    return {
      confidence: 'high',
      reason: 'inat_url_in_gbif',
      groupId: buildGroupId(['inat-url', urlId]),
      candidateOnly: false,
    }
  }

  if (
    shouldSkipCoordinateDedup(gbif) ||
    shouldSkipCoordinateDedup(inat) ||
    !hasPreciseDate(gbif) ||
    !hasPreciseDate(inat)
  ) {
    return null
  }

  const sameTaxon = gbif.scientificName.toLowerCase() === inat.scientificName.toLowerCase()
  const sameDate = dateKey(gbif.observedAt) === dateKey(inat.observedAt)
  if (!sameTaxon || !sameDate) return null

  if (!coordsWithinTolerance(gbif, inat)) return null

  const provenance = detectGbifInaturalistProvenance(gbif)
  if (provenance.isFromInaturalist) {
    return {
      confidence: 'medium',
      reason: 'probable_cross_source',
      candidateOnly: true,
    }
  }

  return {
    confidence: 'low',
    reason: 'similar_unverified',
    candidateOnly: true,
  }
}

function pickStrongerMatch(current: MatchResult | undefined, next: MatchResult): MatchResult {
  if (!current) return next
  const rank: Record<DeduplicationConfidence, number> = {
    exact: 4,
    high: 3,
    medium: 2,
    low: 1,
  }
  return rank[next.confidence] > rank[current.confidence] ? next : current
}

/**
 * Deduplicación conservadora entre GBIF e iNaturalist.
 * Solo exact/high agrupan automáticamente; medium/low son candidatos reportados.
 */
export function markBiodiversityDuplicates(
  occurrences: BiodiversityOccurrence[],
): BiodiversityOccurrence[] {
  const marked = occurrences.map((o) => ({ ...o }))
  const gbif = marked.filter((o) => o.source === 'gbif')
  const inat = marked.filter((o) => o.source === 'inaturalist')
  const inatById = new Map(inat.map((o) => [o.sourceOccurrenceId, o]))
  const matches = new Map<string, MatchResult>()

  for (const gbifOcc of gbif) {
    const directId = resolveInatIdFromGbif(gbifOcc)
    const candidates = directId && inatById.has(directId) ? [inatById.get(directId)!] : inat

    for (const inatOcc of candidates) {
      const result = evaluateGbifInatPair(gbifOcc, inatOcc)
      if (!result) continue

      const gbifKey = occurrenceKey(gbifOcc)
      const inatKey = occurrenceKey(inatOcc)
      matches.set(gbifKey, pickStrongerMatch(matches.get(gbifKey), result))
      matches.set(inatKey, pickStrongerMatch(matches.get(inatKey), result))
    }
  }

  return marked.map((occ) => {
    const provenance =
      occ.source === 'gbif' ? detectGbifInaturalistProvenance(occ) : undefined
    const match = matches.get(occurrenceKey(occ))
    if (!match) {
      return {
        ...occ,
        gbifInaturalistProvenance: provenance,
        possibleDuplicate: false,
        duplicateCandidate: false,
      }
    }

    const autoGroup = !match.candidateOnly && (match.confidence === 'exact' || match.confidence === 'high')
    const warnings = [...occ.qualityWarnings]
    if (autoGroup) {
      warnings.push(`possible_duplicate:${match.reason}`)
    } else {
      warnings.push(`duplicate_candidate:${match.reason}`)
    }

    return {
      ...occ,
      gbifInaturalistProvenance: provenance,
      deduplicationConfidence: match.confidence,
      deduplicationReason: match.reason,
      possibleDuplicate: autoGroup,
      duplicateGroupId: autoGroup ? match.groupId : undefined,
      duplicateCandidate: match.candidateOnly,
    }
  })
}

export function countPossibleDuplicates(occurrences: BiodiversityOccurrence[]): number {
  return occurrences.filter((o) => o.possibleDuplicate).length
}

export function countDuplicateCandidates(occurrences: BiodiversityOccurrence[]): number {
  return occurrences.filter((o) => o.duplicateCandidate).length
}
