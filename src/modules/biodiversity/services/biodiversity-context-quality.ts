import type { BiodiversityOccurrence, BiodiversityProviderId } from '../biodiversity.types'
import {
  buildNormalizedTaxonomicDistribution,
  type BiodiversityTaxonGroupKey,
} from '../biodiversity-taxon-groups'
import { classifySpatialPrivacy } from './biodiversity-event-privacy'

export type BiodiversityContextQualityLevel = 'high' | 'moderate' | 'limited' | 'very_limited'

export type BiodiversityContextQualityReason =
  | 'provider_partial'
  | 'single_provider_only'
  | 'low_observation_effort'
  | 'no_recent_observations'
  | 'historical_only'
  | 'spatial_precision_limited'
  | 'sample_truncated'
  | 'license_limited_media'
  | 'event_outside_monitored_zones'
  | 'high_duplicate_rate'
  | 'provider_unavailable'

export interface BiodiversityContextQuality {
  level: BiodiversityContextQualityLevel
  providerCoverage: number
  spatialPrecisionCoverage: number
  temporalCoverage: number
  mediaCoverage: number
  observationEffort: number
  truncationStatus: 'none' | 'truncated'
  reasons: BiodiversityContextQualityReason[]
}

export interface BiodiversityZoneMetrics {
  radius_m: number
  unique_species_documented: number
  observations_documented: number
  observations_recent_30d: number
  observations_recent_90d: number
  event_window_observations: number
  gbif_count: number
  inaturalist_count: number
  research_grade_inaturalist: number
  generalized_count: number
  obscured_count: number
  spatially_excluded_count: number
  duplicated_count: number
  media_usable_count: number
  latest_observation_at: string | null
  taxa_distribution: Record<BiodiversityTaxonGroupKey, number>
  truncated: boolean
  warnings: string[]
}

function parseObservedAt(iso?: string): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

export function buildBiodiversityZoneMetrics(input: {
  radiusM: number
  eligible: BiodiversityOccurrence[]
  excludedCount: number
  truncated: boolean
  recent30Start: number
  recent90Start: number
  eventWindowStart: number
  eventWindowEnd: number
}): BiodiversityZoneMetrics {
  const warnings: string[] = []
  if (input.excludedCount > 0) warnings.push('spatial_precision_limited')
  if (input.truncated) warnings.push('sample_truncated')

  let recent30 = 0
  let recent90 = 0
  let eventWindow = 0
  let latest: number | null = null
  let generalized = 0
  let obscured = 0
  let mediaUsable = 0
  let duplicates = 0
  const byProvider: Partial<Record<BiodiversityProviderId, number>> = {}

  for (const occ of input.eligible) {
    byProvider[occ.source] = (byProvider[occ.source] ?? 0) + 1
    const privacy = classifySpatialPrivacy(occ)
    if (privacy === 'generalized' || privacy === 'sensitive') generalized += 1
    if (privacy === 'obscured') obscured += 1
    if (occ.possibleDuplicate) duplicates += 1
    if (occ.visualMedia?.imageUrl) mediaUsable += 1

    const t = parseObservedAt(occ.observedAt)
    if (t != null) {
      if (t >= input.recent30Start) recent30 += 1
      if (t >= input.recent90Start) recent90 += 1
      if (t >= input.eventWindowStart && t <= input.eventWindowEnd) eventWindow += 1
      if (latest == null || t > latest) latest = t
    }
  }

  return {
    radius_m: input.radiusM,
    unique_species_documented: new Set(input.eligible.map((o) => o.scientificName)).size,
    observations_documented: input.eligible.length,
    observations_recent_30d: recent30,
    observations_recent_90d: recent90,
    event_window_observations: eventWindow,
    gbif_count: byProvider.gbif ?? 0,
    inaturalist_count: byProvider.inaturalist ?? 0,
    research_grade_inaturalist: input.eligible.filter(
      (o) => o.source === 'inaturalist' && o.qualityGrade?.toLowerCase() === 'research',
    ).length,
    generalized_count: generalized,
    obscured_count: obscured,
    spatially_excluded_count: input.excludedCount,
    duplicated_count: duplicates,
    media_usable_count: mediaUsable,
    latest_observation_at: latest != null ? new Date(latest).toISOString() : null,
    taxa_distribution: buildNormalizedTaxonomicDistribution(input.eligible),
    truncated: input.truncated,
    warnings,
  }
}

export function buildBiodiversityContextQuality(input: {
  zones: BiodiversityZoneMetrics[]
  providerStatus: Partial<Record<BiodiversityProviderId, 'ok' | 'error'>>
  truncated: boolean
  monitoredRelation?: string
  totalFetched: number
}): BiodiversityContextQuality {
  const reasons: BiodiversityContextQualityReason[] = []
  const largest = input.zones.reduce(
    (best, z) => (z.radius_m > (best?.radius_m ?? 0) ? z : best),
    input.zones[0],
  )
  const observations = largest?.observations_documented ?? 0
  const recent30 = largest?.observations_recent_30d ?? 0
  const excluded = largest?.spatially_excluded_count ?? 0
  const duplicates = largest?.duplicated_count ?? 0
  const media = largest?.media_usable_count ?? 0

  const providersOk = Object.values(input.providerStatus).filter((s) => s === 'ok').length
  const providersTotal = 2
  const providerCoverage = providersOk / providersTotal

  if (providersOk === 1) reasons.push('provider_partial')
  if (providersOk === 0) reasons.push('provider_unavailable')
  if (providersOk === 1) reasons.push('single_provider_only')
  if (observations < 20) reasons.push('low_observation_effort')
  if (recent30 === 0 && observations > 0) reasons.push('no_recent_observations')
  if (recent30 === 0 && observations > 0) reasons.push('historical_only')
  if (excluded > 0) reasons.push('spatial_precision_limited')
  if (input.truncated) reasons.push('sample_truncated')
  if (media === 0 && observations > 0) reasons.push('license_limited_media')
  if (input.monitoredRelation === 'outside') reasons.push('event_outside_monitored_zones')
  if (duplicates > observations * 0.25 && duplicates > 3) reasons.push('high_duplicate_rate')

  const spatialPrecisionCoverage =
    observations + excluded > 0 ? observations / (observations + excluded) : 0
  const temporalCoverage = observations > 0 ? Math.min(1, recent30 / Math.max(observations, 1)) : 0
  const mediaCoverage = observations > 0 ? Math.min(1, media / Math.max(observations, 1)) : 0
  const observationEffort = Math.min(1, observations / 100)

  let level: BiodiversityContextQualityLevel = 'moderate'
  const score =
    providerCoverage * 0.25 +
    spatialPrecisionCoverage * 0.2 +
    temporalCoverage * 0.15 +
    mediaCoverage * 0.1 +
    observationEffort * 0.3

  if (providersOk === 0) level = 'very_limited'
  else if (score >= 0.7 && observations >= 40) level = 'high'
  else if (score >= 0.45) level = 'moderate'
  else if (score >= 0.25) level = 'limited'
  else level = 'very_limited'

  return {
    level,
    providerCoverage,
    spatialPrecisionCoverage,
    temporalCoverage,
    mediaCoverage,
    observationEffort,
    truncationStatus: input.truncated ? 'truncated' : 'none',
    reasons: [...new Set(reasons)],
  }
}
