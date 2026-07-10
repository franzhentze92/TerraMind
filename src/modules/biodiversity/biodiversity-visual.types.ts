import type { BiodiversityProviderId, BiodiversityPrivacyLevel } from './biodiversity.types'
import type { BiodiversityTaxonGroupKey } from './biodiversity-taxon-groups'
import type { BiodiversityDashboardFilters } from './dto/biodiversity-dashboard.dto'

/** Media normalizada por observación (solo DTOs visuales). */
export interface BiodiversityObservationVisual {
  source: BiodiversityProviderId
  sourceOccurrenceId: string
  sourceTaxonId?: string
  imageUrl: string
  thumbnailUrl: string
  imageLicense?: string
  imageAttribution: string
  observationUrl: string
  taxonName: string
  commonName?: string
  taxonomicGroup: BiodiversityTaxonGroupKey
  taxonomicGroupLabel: string
  observedAt?: string
  zoneCode: string
  zoneName: string
  qualityGrade?: string
  privacyLevel: BiodiversityPrivacyLevel
  coordinatesPrivacyLabel: string
  isRecent: boolean
  isVisualCandidate: boolean
  sortScore: number
  observationCountInSample?: number
  zonesInSample?: string[]
}

export interface BiodiversityFeaturedSpeciesDto {
  scientificName: string
  commonName?: string
  taxonomicGroupLabel: string
  primaryZoneCode: string
  primaryZoneName: string
  imageUrl: string
  thumbnailUrl: string
  imageLicense?: string
  imageAttribution: string
  observationUrl: string
  source: BiodiversityProviderId
  sourceOccurrenceId: string
  observedAt?: string
  isRecent: boolean
  observationCount: number
}

export interface BiodiversityZoneVisualHighlightDto {
  zoneCode: string
  zoneName: string
  coverImageUrl?: string
  coverThumbnailUrl?: string
  topSpecies: string[]
  observationsCount: number
  recentCount: number
  speciesCount: number
  lastObservedAt?: string
  narrative: string
}

export type BiodiversityVisualSummaryStatus =
  | 'success'
  | 'partial'
  | 'empty'
  | 'provider_unavailable'
  | 'all_media_rejected'
  | 'error'

export interface BiodiversityVisualDiagnostics {
  gbif_occurrences: number
  inaturalist_occurrences: number
  gbif_with_media: number
  inaturalist_with_media: number
  rejected_no_image: number
  rejected_license: number
  provider_errors: Partial<Record<'gbif' | 'inaturalist', string>>
  cache_hit: boolean
  fetch_ms: number
}

export interface BiodiversityVisualSummaryDto {
  generated_at: string
  filters_applied: BiodiversityDashboardFilters
  status: BiodiversityVisualSummaryStatus
  narrative: string
  featured_species: BiodiversityFeaturedSpeciesDto[]
  recent_observations: BiodiversityObservationVisual[]
  zone_highlights: BiodiversityZoneVisualHighlightDto[]
  disclaimer: string
  attribution_notice: string
  diagnostics?: BiodiversityVisualDiagnostics
}

export interface BiodiversityVisualDetailDto {
  generated_at: string
  observation: BiodiversityObservationVisual
  gallery: Array<{ imageUrl: string; thumbnailUrl: string; imageLicense?: string }>
  taxonomy: {
    scientificName: string
    commonName?: string
    taxonomicGroupLabel: string
    taxonRank?: string
  }
  narrative: string
  disclaimer: string
}
