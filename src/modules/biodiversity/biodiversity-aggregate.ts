import type { BiodiversityOccurrence, BiodiversityProviderId } from './biodiversity.types'
import { canExposeExactLocation } from './biodiversity-privacy'

export interface BiodiversitySearchAggregate {
  total_records: number
  unique_species: number
  by_provider: Partial<Record<BiodiversityProviderId, number>>
  by_taxonomic_group: Record<string, number>
  research_grade_count: number
  obscured_count: number
  captive_count: number
  unknown_license_count: number
  possible_duplicate_count: number
  coordinates_exposed_count: number
}

/** Agregados sin exponer puntos — apto para búsquedas summary. */
export function buildBiodiversitySearchAggregate(
  occurrences: BiodiversityOccurrence[],
): BiodiversitySearchAggregate {
  const byProvider: Partial<Record<BiodiversityProviderId, number>> = {}
  const byGroup: Record<string, number> = {}

  for (const occ of occurrences) {
    byProvider[occ.source] = (byProvider[occ.source] ?? 0) + 1
    const group = occ.kingdom ?? occ.className ?? 'unknown'
    byGroup[group] = (byGroup[group] ?? 0) + 1
  }

  return {
    total_records: occurrences.length,
    unique_species: new Set(occurrences.map((o) => o.scientificName)).size,
    by_provider: byProvider,
    by_taxonomic_group: byGroup,
    research_grade_count: occurrences.filter((o) => o.qualityGrade?.toLowerCase() === 'research')
      .length,
    obscured_count: occurrences.filter(
      (o) => o.coordinatesObscured || !canExposeExactLocation(o.privacyLevel),
    ).length,
    captive_count: occurrences.filter((o) => o.captiveOrCultivated).length,
    unknown_license_count: occurrences.filter((o) => o.qualityWarnings.includes('unknown_license'))
      .length,
    possible_duplicate_count: occurrences.filter((o) => o.possibleDuplicate).length,
    coordinates_exposed_count: occurrences.filter((o) => canExposeExactLocation(o.privacyLevel))
      .length,
  }
}
