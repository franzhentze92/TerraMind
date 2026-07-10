import type { BiodiversityOccurrence, BiodiversityProviderId } from './biodiversity.types'
import { canExposeExactLocation } from './biodiversity-privacy'
import {
  buildNormalizedTaxonomicDistribution,
  type BiodiversityTaxonGroupKey,
} from './biodiversity-taxon-groups'

export interface BiodiversitySearchAggregate {
  total_records: number
  unique_species: number
  by_provider: Partial<Record<BiodiversityProviderId, number>>
  by_taxonomic_group: Record<BiodiversityTaxonGroupKey, number>
  research_grade_count: number
  inaturalist_research_grade_count: number
  inaturalist_total_count: number
  obscured_count: number
  captive_count: number
  unknown_license_count: number
  possible_duplicate_count: number
  coordinates_present_count: number
  coordinates_exposed_count: number
}

function hasCoordinatePresent(occ: BiodiversityOccurrence): boolean {
  return (
    (occ.latitude !== undefined && occ.longitude !== undefined) ||
    occ.coordinatesObscured ||
    occ.privacyLevel === 'public_generalized' ||
    occ.privacyLevel === 'sensitive_generalized'
  )
}

/** Agregados sin exponer puntos — apto para búsquedas summary. */
export function buildBiodiversitySearchAggregate(
  occurrences: BiodiversityOccurrence[],
): BiodiversitySearchAggregate {
  const byProvider: Partial<Record<BiodiversityProviderId, number>> = {}
  const inatOccurrences = occurrences.filter((o) => o.source === 'inaturalist')

  for (const occ of occurrences) {
    byProvider[occ.source] = (byProvider[occ.source] ?? 0) + 1
  }

  return {
    total_records: occurrences.length,
    unique_species: new Set(occurrences.map((o) => o.scientificName)).size,
    by_provider: byProvider,
    by_taxonomic_group: buildNormalizedTaxonomicDistribution(occurrences),
    research_grade_count: occurrences.filter((o) => o.qualityGrade?.toLowerCase() === 'research')
      .length,
    inaturalist_research_grade_count: inatOccurrences.filter(
      (o) => o.qualityGrade?.toLowerCase() === 'research',
    ).length,
    inaturalist_total_count: inatOccurrences.length,
    obscured_count: occurrences.filter(
      (o) => o.coordinatesObscured || !canExposeExactLocation(o.privacyLevel),
    ).length,
    captive_count: occurrences.filter((o) => o.captiveOrCultivated).length,
    unknown_license_count: occurrences.filter((o) => o.qualityWarnings.includes('unknown_license'))
      .length,
    possible_duplicate_count: occurrences.filter((o) => o.possibleDuplicate).length,
    coordinates_present_count: occurrences.filter(hasCoordinatePresent).length,
    coordinates_exposed_count: occurrences.filter((o) => canExposeExactLocation(o.privacyLevel))
      .length,
  }
}
