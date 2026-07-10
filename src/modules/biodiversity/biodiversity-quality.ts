import type { BiodiversityDataQuality, BiodiversityOccurrence, BiodiversityProviderId } from './biodiversity.types'
import { countPossibleDuplicates } from './biodiversity-deduplication'

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

export function buildBiodiversityDataQuality(
  provider: BiodiversityProviderId,
  occurrences: BiodiversityOccurrence[],
): BiodiversityDataQuality {
  const count = occurrences.length
  const withCoords = occurrences.filter(
    (o) => o.latitude !== undefined && o.longitude !== undefined,
  ).length
  const withDate = occurrences.filter((o) => o.observedAt).length
  const withTaxon = occurrences.filter((o) => o.scientificName && o.scientificName !== 'Unknown').length
  const researchGrade = occurrences.filter((o) => o.qualityGrade?.toLowerCase() === 'research').length
  const obscured = occurrences.filter((o) => o.coordinatesObscured || o.privacyLevel !== 'public_exact').length
  const captive = occurrences.filter((o) => o.captiveOrCultivated).length
  const unknownLicense = occurrences.filter((o) => o.qualityWarnings.includes('unknown_license')).length

  const warnings: string[] = []
  if (count < 5) warnings.push('low_sample_size')
  if (pct(withCoords, count) < 80) warnings.push('low_coordinate_completeness')
  if (unknownLicense > 0) warnings.push('records_with_unknown_license')

  return {
    provider,
    recordsCount: count,
    coordinateCompletenessPct: pct(withCoords, count),
    dateCompletenessPct: pct(withDate, count),
    taxonResolutionPct: pct(withTaxon, count),
    researchGradePct: provider === 'inaturalist' ? pct(researchGrade, count) : undefined,
    obscuredCount: obscured,
    captiveCount: captive,
    unknownLicenseCount: unknownLicense,
    possibleDuplicateCount: countPossibleDuplicates(occurrences),
    warnings,
  }
}
