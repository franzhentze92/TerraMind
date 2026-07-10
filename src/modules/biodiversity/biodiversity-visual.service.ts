import type { BiodiversityOccurrence } from './biodiversity.types'
import { BIODIVERSITY_CONFIG } from './config/biodiversity.config'
import {
  getBiodiversityZoneByCode,
  getEnabledBiodiversityZones,
  type BiodiversityMonitoredZone,
} from './config/biodiversity-zones.config'
import { partitionAcceptedOccurrences } from './biodiversity-acceptance'
import type { BiodiversityDashboardFilters } from './dto/biodiversity-dashboard.dto'
import { periodToObservedFrom } from './dto/biodiversity-dashboard.dto'
import { getBiodiversityService } from './biodiversity.service'
import { buildAttributionNotice } from './biodiversity-license'
import { occurrenceToVisual } from './biodiversity-visual-extract'
import {
  buildVisualDetailNarrative,
  buildVisualSummaryNarrative,
  periodLabelFromFilters,
} from './biodiversity-visual-narrative'
import { selectFeaturedSpecies, selectRecentVisuals, scoreVisualCandidate } from './biodiversity-visual-select'
import type {
  BiodiversityObservationVisual,
  BiodiversityVisualDetailDto,
  BiodiversityVisualDiagnostics,
  BiodiversityVisualSummaryDto,
  BiodiversityVisualSummaryStatus,
  BiodiversityZoneVisualHighlightDto,
} from './biodiversity-visual.types'
import { getCached, setCached } from './utils/cache'
import { mapWithConcurrency } from './utils/concurrency'

const VISUAL_CACHE_TTL_MS = 30 * 60 * 1000
const RECENT_30D_MS = 30 * 24 * 60 * 60 * 1000
const VISUAL_LIMIT_PER_ZONE = 80

function parseObservedAt(iso?: string): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

function isRecentOccurrence(occ: BiodiversityOccurrence, now = Date.now()): boolean {
  const t = parseObservedAt(occ.observedAt)
  return t !== null && now - t <= RECENT_30D_MS
}

function visualCacheKey(filters: BiodiversityDashboardFilters): string {
  return `visual:${JSON.stringify(filters)}`
}

export class BiodiversityVisualService {
  async getVisualSummary(
    filters: BiodiversityDashboardFilters,
    options: { skipCache?: boolean } = {},
  ): Promise<BiodiversityVisualSummaryDto> {
    const started = Date.now()
    const cacheKey = visualCacheKey(filters)
    if (!options.skipCache) {
      const cached = getCached<BiodiversityVisualSummaryDto>(cacheKey)
      if (cached) {
        return {
          ...cached,
          diagnostics: {
            ...(cached.diagnostics ?? {
              gbif_occurrences: 0,
              inaturalist_occurrences: 0,
              gbif_with_media: 0,
              inaturalist_with_media: 0,
              rejected_no_image: 0,
              rejected_license: 0,
              provider_errors: {},
              fetch_ms: 0,
            }),
            cache_hit: true,
          },
        }
      }
    }

    const zones = filters.zone !== 'all'
      ? [getBiodiversityZoneByCode(filters.zone)].filter(Boolean) as BiodiversityMonitoredZone[]
      : getEnabledBiodiversityZones()

    const biodiversity = getBiodiversityService()
    const diagnostics: BiodiversityVisualDiagnostics = {
      gbif_occurrences: 0,
      inaturalist_occurrences: 0,
      gbif_with_media: 0,
      inaturalist_with_media: 0,
      rejected_no_image: 0,
      rejected_license: 0,
      provider_errors: {},
      cache_hit: false,
      fetch_ms: 0,
    }

    const zoneVisuals = await mapWithConcurrency(zones, 2, async (zone) => {
      const result = await biodiversity.searchOccurrences({
        latitude: zone.latitude,
        longitude: zone.longitude,
        radiusM: zone.radiusM,
        observedFrom: periodToObservedFrom(filters.period),
        providers: filters.source === 'all' ? undefined : [filters.source],
        limit: VISUAL_LIMIT_PER_ZONE,
        mode: 'summary',
        preferVisualMedia: true,
      })

      Object.assign(diagnostics.provider_errors, result.providerErrors)

      const { accepted } = partitionAcceptedOccurrences(result.items)
      for (const occ of accepted) {
        if (occ.source === 'gbif') diagnostics.gbif_occurrences += 1
        if (occ.source === 'inaturalist') diagnostics.inaturalist_occurrences += 1
        if (occ.visualMedia) {
          if (occ.source === 'gbif') diagnostics.gbif_with_media += 1
          if (occ.source === 'inaturalist') diagnostics.inaturalist_with_media += 1
        } else {
          diagnostics.rejected_no_image += 1
        }
      }

      const seenSpecies = new Set<string>()
      const visuals = accepted
        .map((occ) => {
          const v = occurrenceToVisual(
            occ,
            { code: zone.code, name: zone.name },
            isRecentOccurrence(occ),
          )
          if (!v) {
            if (occ.visualMedia) diagnostics.rejected_license += 1
            return null
          }
          v.sortScore = scoreVisualCandidate(v, seenSpecies)
          seenSpecies.add(v.taxonName)
          return v
        })
        .filter((v): v is BiodiversityObservationVisual => v !== null)
      return { zone, visuals, occurrences: accepted }
    })

    diagnostics.fetch_ms = Date.now() - started

    const allVisuals = zoneVisuals.flatMap((z) => z.visuals)
    const featured = selectFeaturedSpecies(allVisuals, 8)
    const recent = selectRecentVisuals(allVisuals, 12)

    const zoneHighlights: BiodiversityZoneVisualHighlightDto[] = zoneVisuals.map(
      ({ zone, visuals, occurrences }) => {
        const cover = visuals.sort((a, b) => b.sortScore - a.sortScore)[0] ?? visuals[0]
        const species = new Set(occurrences.map((o) => o.scientificName))
        const recentCount = occurrences.filter((o) => isRecentOccurrence(o)).length
        const lastObserved = occurrences
          .map((o) => o.observedAt)
          .filter(Boolean)
          .sort()
          .reverse()[0]
        const topSpecies = [...species].slice(0, 4)
        const lowCoverage = occurrences.length < 15

        return {
          zoneCode: zone.code,
          zoneName: zone.name,
          coverImageUrl: cover?.imageUrl,
          coverThumbnailUrl: cover?.thumbnailUrl,
          topSpecies,
          observationsCount: occurrences.length,
          recentCount,
          speciesCount: species.size,
          lastObservedAt: lastObserved,
          narrative: lowCoverage
            ? `${zone.name} muestra baja cobertura de observación en el período; la evidencia visual es limitada.`
            : `${zone.name} documenta ${species.size} especies con ${visuals.length} registro(s) visual(es) en la muestra.`,
        }
      },
    )

    const periodLabel = periodLabelFromFilters(filters)
    const providerErrorCount = Object.keys(diagnostics.provider_errors).length
    let status: BiodiversityVisualSummaryStatus = 'success'
    if (providerErrorCount >= 2) status = 'provider_unavailable'
    else if (providerErrorCount > 0) status = 'partial'
    else if (allVisuals.length === 0 && diagnostics.rejected_license > 0) status = 'all_media_rejected'
    else if (allVisuals.length === 0) status = 'empty'

    const dto: BiodiversityVisualSummaryDto = {
      generated_at: new Date().toISOString(),
      filters_applied: filters,
      status,
      narrative: buildVisualSummaryNarrative({
        featuredCount: featured.length,
        recentCount: recent.length,
        zoneHighlights: zoneHighlights.map((z) => ({
          zoneName: z.zoneName,
          recentCount: z.recentCount,
          speciesCount: z.speciesCount,
        })),
        periodLabel,
      }),
      featured_species: featured,
      recent_observations: recent,
      zone_highlights: zoneHighlights,
      disclaimer: BIODIVERSITY_CONFIG.disclaimer,
      attribution_notice:
        'Imágenes mostradas bajo licencia y atribución del registro fuente. No redistribuir sin verificar términos.',
      diagnostics,
    }

    setCached(cacheKey, dto, VISUAL_CACHE_TTL_MS)
    return dto
  }

  async getVisualDetail(
    source: string,
    occurrenceId: string,
    filters: BiodiversityDashboardFilters,
  ): Promise<BiodiversityVisualDetailDto | null> {
    const summary = await this.getVisualSummary(filters)
    const match = summary.recent_observations.find(
      (o) => o.source === source && o.sourceOccurrenceId === occurrenceId,
    )

    if (!match) {
      const featured = summary.featured_species.find(
        (f) => f.source === source && f.sourceOccurrenceId === occurrenceId,
      )
      if (!featured) return null
      const observation: BiodiversityObservationVisual = {
        source: featured.source,
        sourceOccurrenceId: featured.sourceOccurrenceId,
        imageUrl: featured.imageUrl,
        thumbnailUrl: featured.thumbnailUrl,
        imageLicense: featured.imageLicense,
        imageAttribution: featured.imageAttribution,
        observationUrl: featured.observationUrl,
        taxonName: featured.scientificName,
        commonName: featured.commonName,
        taxonomicGroup: 'other',
        taxonomicGroupLabel: featured.taxonomicGroupLabel,
        observedAt: featured.observedAt,
        zoneCode: featured.primaryZoneCode,
        zoneName: featured.primaryZoneName,
        privacyLevel: 'public_exact',
        coordinatesPrivacyLabel: 'ubicación según fuente',
        isRecent: featured.isRecent,
        isVisualCandidate: true,
        sortScore: 0,
        observationCountInSample: featured.observationCount,
      }
      return {
        generated_at: new Date().toISOString(),
        observation,
        gallery: [
          {
            imageUrl: observation.imageUrl,
            thumbnailUrl: observation.thumbnailUrl,
            imageLicense: observation.imageLicense,
          },
        ],
        taxonomy: {
          scientificName: observation.taxonName,
          commonName: observation.commonName,
          taxonomicGroupLabel: observation.taxonomicGroupLabel,
        },
        narrative: buildVisualDetailNarrative(observation),
        disclaimer: `${BIODIVERSITY_CONFIG.disclaimer} ${buildAttributionNotice(observation.source)}`,
      }
    }

    return {
      generated_at: new Date().toISOString(),
      observation: match,
      gallery: [{ imageUrl: match.imageUrl, thumbnailUrl: match.thumbnailUrl, imageLicense: match.imageLicense }],
      taxonomy: {
        scientificName: match.taxonName,
        commonName: match.commonName,
        taxonomicGroupLabel: match.taxonomicGroupLabel,
      },
      narrative: buildVisualDetailNarrative(match),
      disclaimer: `${BIODIVERSITY_CONFIG.disclaimer} ${buildAttributionNotice(match.source)}`,
    }
  }
}

let singleton: BiodiversityVisualService | null = null

export function getBiodiversityVisualService(): BiodiversityVisualService {
  if (!singleton) singleton = new BiodiversityVisualService()
  return singleton
}
