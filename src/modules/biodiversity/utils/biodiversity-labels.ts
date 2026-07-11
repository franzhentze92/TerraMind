import { humanizeToken } from '@/shared/product-language'

/** Provider identifiers rendered with correct casing (never raw/uppercased). */
export function biodiversityProviderLabel(provider: string): string {
  const map: Record<string, string> = {
    gbif: 'GBIF',
    inaturalist: 'iNaturalist',
    all: 'Todas las fuentes',
  }
  return map[provider?.toLowerCase?.() ?? provider] ?? humanizeToken(provider)
}

/** iNaturalist / GBIF quality grades translated to Spanish. */
export function biodiversityQualityGradeLabel(grade: string): string {
  const map: Record<string, string> = {
    research: 'Grado de investigación',
    needs_id: 'Necesita identificación',
    casual: 'Casual',
  }
  return map[grade?.toLowerCase?.() ?? grade] ?? humanizeToken(grade)
}
