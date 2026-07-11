import type { BiodiversityOccurrence, BiodiversityProviderId } from '../biodiversity.types'
import { BIODIVERSITY_CONFIG } from '../config/biodiversity.config'
import { BIODIVERSITY_EVENT_CONFIG } from '../config/biodiversity-event.config'
import { BiodiversityService } from '../biodiversity.service'
import { occurrenceToVisual } from '../biodiversity-visual-extract'
import { selectFeaturedSpecies } from '../biodiversity-visual-select'
import type { BiodiversityObservationVisual } from '../biodiversity-visual.types'
import {
  buildBiodiversityContextQuality,
  buildBiodiversityZoneMetrics,
  type BiodiversityContextQuality,
  type BiodiversityZoneMetrics,
} from './biodiversity-context-quality'
import {
  isSpatiallyEligibleForRadius,
  privacyStatusForApi,
} from './biodiversity-event-privacy'
import {
  resolveMonitoredZoneContext,
  type ResolvedMonitoredZoneContext,
} from './biodiversity-monitored-zone-relation'
import {
  resolveBiodiversityAnalysisPoint,
  type BiodiversityAnalysisPoint,
  type BiodiversityGeometrySource,
} from './biodiversity-event-spatial'

export interface BiodiversityVisualHighlight {
  common_name: string | null
  taxon_name: string
  taxonomic_group: string
  thumbnail_url: string | null
  image_url: string | null
  image_license: string | null
  image_attribution: string | null
  observation_url: string
  observed_at: string | null
  privacy_status: string
  source: BiodiversityProviderId
  source_occurrence_id: string
  sort_order: number
}

export interface BiodiversityEventAnalysis {
  geometrySource: BiodiversityGeometrySource
  analysisPoint: BiodiversityAnalysisPoint
  historyStart: string
  historyEnd: string
  providerStatus: Partial<Record<BiodiversityProviderId, 'ok' | 'error'>>
  providerErrors: Partial<Record<BiodiversityProviderId, string>>
  zones: BiodiversityZoneMetrics[]
  summary: {
    unique_species_documented: number
    observations_documented: number
    observations_recent_30d: number
    observations_recent_90d: number
    provider_distribution: Partial<Record<BiodiversityProviderId, number>>
    taxa_distribution: BiodiversityZoneMetrics['taxa_distribution']
  }
  quality: BiodiversityContextQuality
  monitoredZoneContext: ResolvedMonitoredZoneContext
  visualHighlights: BiodiversityVisualHighlight[]
  warnings: string[]
  truncated: boolean
  metrics: {
    cache_hit: boolean
    provider_duration_ms: number
    fetched_count: number
    deduplicated_count: number
  }
}

function subtractYears(iso: string, years: number): string {
  const d = new Date(iso)
  d.setUTCFullYear(d.getUTCFullYear() - years)
  return d.toISOString()
}

function subtractDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

function isRecentObservedAt(iso: string | undefined, sinceMs: number): boolean {
  if (!iso) return false
  const t = Date.parse(iso)
  return Number.isFinite(t) && t >= sinceMs
}

export async function analyzeBiodiversityForFireEvent(input: {
  detections: Array<{ latitude: number; longitude: number }>
  centroidLat?: number | null
  centroidLng?: number | null
  eventTime: string
  radiiM?: number[]
}): Promise<BiodiversityEventAnalysis> {
  const started = Date.now()
  const radiiM = [...(input.radiiM ?? BIODIVERSITY_EVENT_CONFIG.radiiM)].sort((a, b) => a - b)
  const maxRadius = radiiM[radiiM.length - 1] ?? 10_000

  const analysisPoint = resolveBiodiversityAnalysisPoint({
    detections: input.detections,
    centroidLat: input.centroidLat,
    centroidLng: input.centroidLng,
  })
  if (!analysisPoint) {
    throw new Error('Evento sin detecciones ni centroide utilizable')
  }

  const historyEnd = input.eventTime
  const historyStart = subtractYears(historyEnd, BIODIVERSITY_EVENT_CONFIG.historyYears)
  const recent30Start = Date.parse(subtractDays(historyEnd, BIODIVERSITY_EVENT_CONFIG.recentDays))
  const recent90Start = Date.parse(subtractDays(historyEnd, BIODIVERSITY_EVENT_CONFIG.recentDays90))
  const eventWindowStart = Date.parse(
    subtractDays(input.eventTime, BIODIVERSITY_EVENT_CONFIG.eventWindowDays),
  )
  const eventWindowEnd = Date.parse(
    addDays(input.eventTime, BIODIVERSITY_EVENT_CONFIG.eventWindowDays),
  )

  const service = new BiodiversityService()
  const fetchLimit = Math.min(
    BIODIVERSITY_EVENT_CONFIG.maxFetchRecords,
    BIODIVERSITY_CONFIG.maxLimit,
  )

  const searchResult = await service.searchOccurrences({
    latitude: analysisPoint.latitude,
    longitude: analysisPoint.longitude,
    radiusM: maxRadius,
    observedFrom: historyStart.slice(0, 10),
    observedTo: historyEnd.slice(0, 10),
    limit: fetchLimit,
    preferVisualMedia: true,
    qualityFilters: {
      requireCoordinates: true,
      excludeCaptiveCultivated: true,
      excludeGeospatialIssues: true,
    },
  })

  const providerStatus: Partial<Record<BiodiversityProviderId, 'ok' | 'error'>> = {}
  for (const provider of ['gbif', 'inaturalist'] as BiodiversityProviderId[]) {
    if (searchResult.providerErrors[provider]) {
      providerStatus[provider] = 'error'
    } else if (searchResult.byProvider[provider]) {
      providerStatus[provider] = 'ok'
    } else {
      providerStatus[provider] = 'error'
    }
  }

  const allOccurrences = searchResult.items
  const truncated =
    allOccurrences.length >= fetchLimit ||
    Boolean(
      searchResult.byProvider.gbif?.truncated || searchResult.byProvider.inaturalist?.truncated,
    )

  const warnings: string[] = []
  if (analysisPoint.geometrySource === 'event_centroid_fallback') {
    warnings.push('event_centroid_fallback')
  }
  if (analysisPoint.maxSpreadM > maxRadius / 2) {
    warnings.push('detection_spread_wide')
  }
  if (truncated) warnings.push('sample_truncated')
  if (providerStatus.gbif === 'error' && providerStatus.inaturalist === 'ok') {
    warnings.push('provider_unavailable')
  }
  if (providerStatus.inaturalist === 'error' && providerStatus.gbif === 'ok') {
    warnings.push('provider_unavailable')
  }

  const zones: BiodiversityZoneMetrics[] = []
  for (const radiusM of radiiM) {
    const eligible: BiodiversityOccurrence[] = []
    let excluded = 0
    for (const occ of allOccurrences) {
      if (isSpatiallyEligibleForRadius(occ, radiusM, analysisPoint)) {
        eligible.push(occ)
      } else {
        excluded += 1
      }
    }
    zones.push(
      buildBiodiversityZoneMetrics({
        radiusM,
        eligible,
        excludedCount: excluded,
        truncated,
        recent30Start,
        recent90Start,
        eventWindowStart,
        eventWindowEnd,
      }),
    )
  }

  const largest = zones[zones.length - 1]
  const monitoredZoneContext = resolveMonitoredZoneContext({
    latitude: analysisPoint.latitude,
    longitude: analysisPoint.longitude,
    maxSpreadM: analysisPoint.maxSpreadM,
    nearFactor: BIODIVERSITY_EVENT_CONFIG.monitoredZoneNearFactor,
  })

  const quality = buildBiodiversityContextQuality({
    zones,
    providerStatus,
    truncated,
    monitoredRelation: monitoredZoneContext.primary?.relation,
    totalFetched: allOccurrences.length,
  })

  const pseudoZone = {
    code: monitoredZoneContext.primary?.zone_code ?? 'event',
    name: monitoredZoneContext.primary?.name ?? 'Entorno del evento',
  }
  const visuals: BiodiversityObservationVisual[] = []
  for (const occ of allOccurrences) {
    const visual = occurrenceToVisual(
      occ,
      pseudoZone,
      isRecentObservedAt(occ.observedAt, recent30Start),
    )
    if (visual) visuals.push(visual)
  }
  const featured = selectFeaturedSpecies(visuals, BIODIVERSITY_EVENT_CONFIG.visualHighlightLimit)
  const visualHighlights: BiodiversityVisualHighlight[] = featured.map((f, idx) => ({
    common_name: f.commonName ?? null,
    taxon_name: f.scientificName,
    taxonomic_group: f.taxonomicGroupLabel,
    thumbnail_url: f.thumbnailUrl ?? null,
    image_url: f.imageUrl ?? null,
    image_license: f.imageLicense ?? null,
    image_attribution: f.imageAttribution ?? null,
    observation_url: f.observationUrl,
    observed_at: f.observedAt ?? null,
    privacy_status: privacyStatusForApi(
      allOccurrences.find((o) => o.sourceOccurrenceId === f.sourceOccurrenceId) ?? {
        privacyLevel: 'private_unavailable',
        coordinatesObscured: true,
        scientificName: f.scientificName,
        source: f.source,
        sourceOccurrenceId: f.sourceOccurrenceId,
        recordKind: 'recent_observation',
        sourceUrl: f.observationUrl,
        qualityWarnings: [],
        possibleDuplicate: false,
        fetchedAt: new Date().toISOString(),
      },
    ),
    source: f.source,
    source_occurrence_id: f.sourceOccurrenceId,
    sort_order: idx,
  }))

  return {
    geometrySource: analysisPoint.geometrySource,
    analysisPoint,
    historyStart,
    historyEnd,
    providerStatus,
    providerErrors: searchResult.providerErrors,
    zones,
    summary: {
      unique_species_documented: largest?.unique_species_documented ?? 0,
      observations_documented: largest?.observations_documented ?? 0,
      observations_recent_30d: largest?.observations_recent_30d ?? 0,
      observations_recent_90d: largest?.observations_recent_90d ?? 0,
      provider_distribution: {
        gbif: providerStatus.gbif === 'ok' ? (largest?.gbif_count ?? 0) : undefined,
        inaturalist:
          providerStatus.inaturalist === 'ok' ? (largest?.inaturalist_count ?? 0) : undefined,
      },
      taxa_distribution: largest?.taxa_distribution ?? ({} as BiodiversityZoneMetrics['taxa_distribution']),
    },
    quality,
    monitoredZoneContext,
    visualHighlights,
    warnings: [...new Set([...warnings, ...quality.reasons])],
    truncated,
    metrics: {
      cache_hit: false,
      provider_duration_ms: Date.now() - started,
      fetched_count: allOccurrences.length,
      deduplicated_count: searchResult.deduplicatedCount,
    },
  }
}
