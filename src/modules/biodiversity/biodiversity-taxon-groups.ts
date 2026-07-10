import type { BiodiversityOccurrence } from './biodiversity.types'

/** Grupos taxonómicos exclusivos para agregación y UI. */
export const BIODIVERSITY_TAXON_GROUP_KEYS = [
  'plants',
  'birds',
  'insects',
  'mammals',
  'reptiles',
  'amphibians',
  'fungi',
  'arachnids',
  'fish',
  'mollusks',
  'other',
] as const

export type BiodiversityTaxonGroupKey = (typeof BIODIVERSITY_TAXON_GROUP_KEYS)[number]

export const BIODIVERSITY_TAXON_GROUP_LABELS: Record<BiodiversityTaxonGroupKey, string> = {
  plants: 'Plantas',
  birds: 'Aves',
  insects: 'Insectos',
  mammals: 'Mamíferos',
  reptiles: 'Reptiles',
  amphibians: 'Anfibios',
  fungi: 'Hongos',
  arachnids: 'Arácnidos',
  fish: 'Peces',
  mollusks: 'Moluscos',
  other: 'Otros',
}

function norm(value?: string): string {
  return (value ?? '').trim().toLowerCase()
}

/**
 * Asigna cada registro a exactamente un grupo amigable (sin mezclar reino/clase/filo).
 */
export function resolveBiodiversityTaxonGroup(occ: BiodiversityOccurrence): BiodiversityTaxonGroupKey {
  const kingdom = norm(occ.kingdom)
  const cls = norm(occ.className)
  const phylum = norm(occ.phylum)
  const order = norm(occ.orderName)

  if (kingdom === 'plantae' || cls === 'magnoliopsida' || cls === 'liliopsida') return 'plants'
  if (kingdom === 'fungi' || cls === 'agaricomycetes') return 'fungi'
  if (cls === 'aves' || kingdom === 'aves') return 'birds'
  if (cls === 'insecta') return 'insects'
  if (cls === 'mammalia') return 'mammals'
  if (cls === 'reptilia') return 'reptiles'
  if (cls === 'amphibia') return 'amphibians'
  if (cls === 'arachnida') return 'arachnids'
  if (
    cls === 'actinopterygii' ||
    cls === 'chondrichthyes' ||
    cls === 'sarcopterygii' ||
    order === 'perciformes'
  ) {
    return 'fish'
  }
  if (cls === 'mollusca' || phylum === 'mollusca') return 'mollusks'

  return 'other'
}

export function buildNormalizedTaxonomicDistribution(
  occurrences: BiodiversityOccurrence[],
): Record<BiodiversityTaxonGroupKey, number> {
  const dist = Object.fromEntries(
    BIODIVERSITY_TAXON_GROUP_KEYS.map((k) => [k, 0]),
  ) as Record<BiodiversityTaxonGroupKey, number>

  for (const occ of occurrences) {
    const group = resolveBiodiversityTaxonGroup(occ)
    dist[group] += 1
  }

  return dist
}

export function topNormalizedTaxonGroups(
  dist: Record<BiodiversityTaxonGroupKey, number>,
  limit = 3,
): string[] {
  return BIODIVERSITY_TAXON_GROUP_KEYS.filter((k) => dist[k] > 0)
    .sort((a, b) => dist[b] - dist[a])
    .slice(0, limit)
    .map((k) => BIODIVERSITY_TAXON_GROUP_LABELS[k])
}
