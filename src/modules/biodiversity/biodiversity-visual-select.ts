import type { BiodiversityObservationVisual, BiodiversityFeaturedSpeciesDto } from './biodiversity-visual.types'
import type { BiodiversityTaxonGroupKey } from './biodiversity-taxon-groups'

const GROUP_DIVERSITY_BONUS: Partial<Record<BiodiversityTaxonGroupKey, number>> = {
  birds: 8,
  mammals: 10,
  reptiles: 8,
  amphibians: 12,
  plants: 6,
  insects: 4,
}

export function scoreVisualCandidate(
  visual: BiodiversityObservationVisual,
  seenSpecies: Set<string>,
): number {
  let score = 40
  if (visual.isRecent) score += 30
  if (visual.qualityGrade?.toLowerCase() === 'research') score += 20
  if (visual.source === 'inaturalist') score += 15
  if (!seenSpecies.has(visual.taxonName)) score += 12
  score += GROUP_DIVERSITY_BONUS[visual.taxonomicGroup] ?? 5
  if (visual.privacyLevel === 'private_unavailable') score -= 20
  return score
}

export function selectFeaturedSpecies(
  visuals: BiodiversityObservationVisual[],
  limit = 8,
): BiodiversityFeaturedSpeciesDto[] {
  const bySpecies = new Map<string, BiodiversityObservationVisual[]>()
  for (const v of visuals) {
    const list = bySpecies.get(v.taxonName) ?? []
    list.push(v)
    bySpecies.set(v.taxonName, list)
  }

  const seen = new Set<string>()
  const featured: BiodiversityFeaturedSpeciesDto[] = []

  const ranked = [...visuals].sort((a, b) => {
    return scoreVisualCandidate(b, seen) - scoreVisualCandidate(a, seen)
  })

  for (const v of ranked) {
    if (featured.length >= limit) break
    if (featured.some((f) => f.scientificName === v.taxonName)) continue
    seen.add(v.taxonName)
    const count = bySpecies.get(v.taxonName)?.length ?? 1
    featured.push({
      scientificName: v.taxonName,
      commonName: v.commonName,
      taxonomicGroupLabel: v.taxonomicGroupLabel,
      primaryZoneCode: v.zoneCode,
      primaryZoneName: v.zoneName,
      imageUrl: v.imageUrl,
      thumbnailUrl: v.thumbnailUrl,
      imageLicense: v.imageLicense,
      imageAttribution: v.imageAttribution,
      observationUrl: v.observationUrl,
      source: v.source,
      sourceOccurrenceId: v.sourceOccurrenceId,
      observedAt: v.observedAt,
      isRecent: v.isRecent,
      observationCount: count,
    })
  }

  return featured
}

export function selectRecentVisuals(
  visuals: BiodiversityObservationVisual[],
  limit = 12,
): BiodiversityObservationVisual[] {
  return [...visuals]
    .sort((a, b) => {
      const ta = a.observedAt ? Date.parse(a.observedAt) : 0
      const tb = b.observedAt ? Date.parse(b.observedAt) : 0
      return tb - ta
    })
    .slice(0, limit)
}
