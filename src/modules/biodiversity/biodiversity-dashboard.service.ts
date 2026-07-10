import type { BiodiversityOccurrence, BiodiversityProviderId } from './biodiversity.types'
import { BIODIVERSITY_CONFIG } from './config/biodiversity.config'
import {
  getBiodiversityZoneByCode,
  getEnabledBiodiversityZones,
  type BiodiversityMonitoredZone,
} from './config/biodiversity-zones.config'
import { partitionAcceptedOccurrences } from './biodiversity-acceptance'
import { buildBiodiversitySearchAggregate } from './biodiversity-aggregate'
import {
  buildNationalBiodiversityNarrative,
  buildZoneBiodiversityNarrative,
} from './biodiversity-dashboard-narrative'
import type {
  BiodiversityDashboardActivity,
  BiodiversityDashboardDataStatus,
  BiodiversityDashboardFilters,
  BiodiversityDashboardSourceItem,
  BiodiversityDashboardSummaryDto,
  BiodiversityDashboardZoneItem,
  BiodiversityPeriod,
  BiodiversityQualityFilter,
  BiodiversitySourceFilter,
  BiodiversityTaxonFilter,
  BiodiversityZoneDetailDto,
  BiodiversityZonesListDto,
} from './dto/biodiversity-dashboard.dto'
import { periodToObservedFrom } from './dto/biodiversity-dashboard.dto'
import { getBiodiversityService, type BiodiversityService } from './biodiversity.service'
import { getCached, setCached } from './utils/cache'
import { mapWithConcurrency } from './utils/concurrency'

const DASHBOARD_CACHE_TTL_MS = 15 * 60 * 1000
const RECENT_30D_MS = 30 * 24 * 60 * 60 * 1000
const RECENT_90D_MS = 90 * 24 * 60 * 60 * 1000

const PERIOD_LABELS: Record<BiodiversityPeriod, string> = {
  '30d': 'los últimos 30 días',
  '90d': 'los últimos 90 días',
  '1y': 'el último año',
  '5y': 'los últimos 5 años',
}

interface ZoneFetchResult {
  zone: BiodiversityMonitoredZone
  occurrences: BiodiversityOccurrence[]
  providerErrors: BiodiversityProviderId[]
  truncated: boolean
}

function taxonGroupLabel(occ: BiodiversityOccurrence): string {
  return occ.kingdom ?? occ.className ?? 'unknown'
}

function matchesTaxonFilter(occ: BiodiversityOccurrence, taxon: BiodiversityTaxonFilter): boolean {
  if (taxon === 'all') return true
  const cls = (occ.className ?? '').toLowerCase()
  const kingdom = (occ.kingdom ?? '').toLowerCase()
  switch (taxon) {
    case 'birds':
      return cls === 'aves' || kingdom === 'aves'
    case 'plants':
      return kingdom === 'plantae'
    case 'mammals':
      return cls === 'mammalia'
    case 'reptiles':
      return cls === 'reptilia'
    case 'amphibians':
      return cls === 'amphibia'
    case 'insects':
      return cls === 'insecta'
    case 'other': {
      const known = ['aves', 'mammalia', 'reptilia', 'amphibia', 'insecta']
      return kingdom !== 'plantae' && !known.includes(cls)
    }
    default:
      return true
  }
}

function matchesQualityFilter(
  occ: BiodiversityOccurrence,
  quality: BiodiversityQualityFilter,
): boolean {
  switch (quality) {
    case 'all':
      return true
    case 'research':
      return occ.qualityGrade?.toLowerCase() === 'research'
    case 'with_coords':
      return occ.latitude !== undefined && occ.longitude !== undefined
    case 'generalized':
      return (
        occ.coordinatesObscured ||
        occ.privacyLevel === 'public_generalized' ||
        occ.privacyLevel === 'sensitive_generalized'
      )
    case 'exclude_captive':
      return !occ.captiveOrCultivated
    default:
      return true
  }
}

function filterOccurrences(
  occurrences: BiodiversityOccurrence[],
  filters: BiodiversityDashboardFilters,
): BiodiversityOccurrence[] {
  return occurrences.filter(
    (o) => matchesTaxonFilter(o, filters.taxon) && matchesQualityFilter(o, filters.quality),
  )
}

function providersFromSource(source: BiodiversitySourceFilter): BiodiversityProviderId[] | undefined {
  if (source === 'all') return undefined
  return [source]
}

function qualityFiltersFromDashboard(quality: BiodiversityQualityFilter) {
  switch (quality) {
    case 'research':
      return {
        researchGradeOnly: true,
        requireCoordinates: true,
        excludeCaptiveCultivated: true,
        excludeGeospatialIssues: true,
      }
    case 'with_coords':
      return { requireCoordinates: true, excludeGeospatialIssues: true }
    case 'exclude_captive':
      return { excludeCaptiveCultivated: true, excludeGeospatialIssues: true }
    default:
      return { excludeGeospatialIssues: true }
  }
}

function parseObservedAt(iso?: string): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

function countRecent(occurrences: BiodiversityOccurrence[], windowMs: number, now = Date.now()): number {
  return occurrences.filter((o) => {
    const t = parseObservedAt(o.observedAt)
    return t !== null && now - t <= windowMs
  }).length
}

function buildActivity(occurrences: BiodiversityOccurrence[], now = Date.now()): BiodiversityDashboardActivity {
  const byMonth = new Map<string, number>()
  for (const occ of occurrences) {
    const t = parseObservedAt(occ.observedAt)
    if (t === null) continue
    const month = new Date(t).toISOString().slice(0, 7)
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1)
  }
  const sorted = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }))

  return {
    by_month: sorted,
    recent_30d: countRecent(occurrences, RECENT_30D_MS, now),
    recent_90d: countRecent(occurrences, RECENT_90D_MS, now),
  }
}

function buildTaxonomicDistribution(occurrences: BiodiversityOccurrence[]): Record<string, number> {
  const dist: Record<string, number> = {}
  for (const occ of occurrences) {
    const group = taxonGroupLabel(occ)
    if (group === 'unknown') continue
    dist[group] = (dist[group] ?? 0) + 1
  }
  return dist
}

function topTaxonomicGroups(dist: Record<string, number>, limit = 3): string[] {
  return Object.entries(dist)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([g]) => g)
}

function buildSources(
  occurrences: BiodiversityOccurrence[],
  health: Awaited<ReturnType<BiodiversityService['getSystemHealth']>>,
): BiodiversityDashboardSourceItem[] {
  const providers: BiodiversityProviderId[] = ['gbif', 'inaturalist']
  return providers.map((provider) => ({
    provider,
    records: occurrences.filter((o) => o.source === provider).length,
    reachable:
      provider === 'gbif' ? health.gbif_reachable : health.inaturalist_reachable,
    last_success: health.last_success_by_provider[provider] ?? null,
  }))
}

function resolveDataStatus(input: {
  providerErrors: BiodiversityProviderId[]
  zoneErrors: number
  truncated: boolean
  recent30d: number
  observations: number
  isCached: boolean
}): BiodiversityDashboardDataStatus {
  if (input.providerErrors.length >= 2) return 'providers_unavailable'
  if (input.truncated) return 'truncated'
  if (input.providerErrors.length > 0 || input.zoneErrors > 0) return 'partial'
  if (input.isCached) return 'stale'
  if (input.observations > 0 && input.recent30d === 0) return 'no_recent_observations'
  return 'success'
}

function dashboardCacheKey(filters: BiodiversityDashboardFilters): string {
  return `dashboard:${JSON.stringify(filters)}`
}

export class BiodiversityDashboardService {
  constructor(private readonly biodiversityService: BiodiversityService = getBiodiversityService()) {}

  listZones(): BiodiversityZonesListDto {
    const zones = getEnabledBiodiversityZones()
    return {
      generated_at: new Date().toISOString(),
      zones: zones.map((z) => ({
        zone_code: z.code,
        zone_name: z.name,
        region_label: z.regionLabel,
        centroid: { lat: z.latitude, lng: z.longitude },
        radius_km: Math.round(z.radiusM / 1000),
      })),
    }
  }

  async getDashboardSummary(
    filters: BiodiversityDashboardFilters,
    options: { skipCache?: boolean } = {},
  ): Promise<BiodiversityDashboardSummaryDto> {
    const cacheKey = dashboardCacheKey(filters)
    if (!options.skipCache) {
      const cached = getCached<BiodiversityDashboardSummaryDto>(cacheKey)
      if (cached) return { ...cached, is_cached: true, data_status: cached.data_status === 'success' ? 'stale' : cached.data_status }
    }

    const zones = this.zonesForFilters(filters)
    const health = await this.biodiversityService.getSystemHealth()
    const zoneResults = await this.fetchZones(zones, filters)

    const allOccurrences = zoneResults.flatMap((r) => r.occurrences)
    const { accepted } = partitionAcceptedOccurrences(allOccurrences)
    const filtered = filterOccurrences(accepted, filters)
    const aggregate = buildBiodiversitySearchAggregate(filtered)
    const activity = buildActivity(filtered)
    const taxonomicDistribution = buildTaxonomicDistribution(filtered)

    const providerErrors = [...new Set(zoneResults.flatMap((r) => r.providerErrors))]
    const zoneErrors = zoneResults.filter((r) => r.providerErrors.length > 0).length
    const truncated = zoneResults.some((r) => r.truncated)

    const zoneItems: BiodiversityDashboardZoneItem[] = zoneResults.map((result) => {
      const { accepted: zoneAccepted } = partitionAcceptedOccurrences(result.occurrences)
      const zoneFiltered = filterOccurrences(zoneAccepted, filters)
      const zoneAgg = buildBiodiversitySearchAggregate(zoneFiltered)
      const zoneDist = buildTaxonomicDistribution(zoneFiltered)
      const zoneRecent = countRecent(zoneFiltered, RECENT_30D_MS)
      const researchPct =
        zoneFiltered.length > 0
          ? Math.round((zoneAgg.research_grade_count / zoneFiltered.length) * 100)
          : 0
      const zoneStatus = resolveDataStatus({
        providerErrors: result.providerErrors,
        zoneErrors: result.providerErrors.length > 0 ? 1 : 0,
        truncated: result.truncated,
        recent30d: zoneRecent,
        observations: zoneFiltered.length,
        isCached: false,
      })

      return {
        zone_code: result.zone.code,
        zone_name: result.zone.name,
        region_label: result.zone.regionLabel,
        centroid: { lat: result.zone.latitude, lng: result.zone.longitude },
        radius_km: Math.round(result.zone.radiusM / 1000),
        species_count: zoneAgg.unique_species,
        observations_count: zoneFiltered.length,
        recent_count: zoneRecent,
        research_grade_pct: researchPct,
        generalized_count: zoneAgg.obscured_count,
        top_taxonomic_groups: topTaxonomicGroups(zoneDist),
        data_status: zoneStatus,
        narrative: buildZoneBiodiversityNarrative({
          zoneName: result.zone.name,
          speciesCount: zoneAgg.unique_species,
          observationsCount: zoneFiltered.length,
          recentCount: zoneRecent,
          periodLabel: PERIOD_LABELS[filters.period],
        }),
      }
    })

    const topZone = [...zoneItems]
      .filter((z) => z.species_count > 0)
      .sort((a, b) => b.species_count - a.species_count)[0]

    const sourcesActive = (['gbif', 'inaturalist'] as const).filter((p) =>
      health[p === 'gbif' ? 'gbif_reachable' : 'inaturalist_reachable'],
    )

    const dataStatus = resolveDataStatus({
      providerErrors,
      zoneErrors,
      truncated,
      recent30d: activity.recent_30d,
      observations: filtered.length,
      isCached: false,
    })

    const dto: BiodiversityDashboardSummaryDto = {
      generated_at: new Date().toISOString(),
      data_status: dataStatus,
      national_summary: {
        species_count: aggregate.unique_species,
        observations_count: filtered.length,
        recent_30d_count: activity.recent_30d,
        zones_monitored: zones.length,
        sources_active: sourcesActive,
        generalized_count: aggregate.obscured_count,
        narrative: buildNationalBiodiversityNarrative({
          speciesCount: aggregate.unique_species,
          observationsCount: filtered.length,
          recent30d: activity.recent_30d,
          zonesMonitored: zones.length,
          topZoneName: topZone?.zone_name ?? null,
          topZoneSpecies: topZone?.species_count ?? 0,
          generalizedCount: aggregate.obscured_count,
          dataStatus,
        }),
      },
      top_zone: topZone
        ? {
            zone_code: topZone.zone_code,
            zone_name: topZone.zone_name,
            species_count: topZone.species_count,
            observations_count: topZone.observations_count,
          }
        : null,
      zones: zoneItems,
      taxonomic_distribution: taxonomicDistribution,
      activity,
      sources: buildSources(filtered, health),
      disclaimer: BIODIVERSITY_CONFIG.disclaimer,
      filters_applied: filters,
    }

    setCached(cacheKey, dto, DASHBOARD_CACHE_TTL_MS)
    return dto
  }

  async getZoneSummary(
    zoneCode: string,
    filters: BiodiversityDashboardFilters,
  ): Promise<BiodiversityZoneDetailDto | null> {
    const zone = getBiodiversityZoneByCode(zoneCode)
    if (!zone) return null

    const health = await this.biodiversityService.getSystemHealth()
    const [result] = await this.fetchZones([zone], filters)
    const { accepted } = partitionAcceptedOccurrences(result.occurrences)
    const filtered = filterOccurrences(accepted, filters)
    const aggregate = buildBiodiversitySearchAggregate(filtered)
    const activity = buildActivity(filtered)
    const taxonomicDistribution = buildTaxonomicDistribution(filtered)
    const recentCount = countRecent(filtered, RECENT_30D_MS)

    const dataStatus = resolveDataStatus({
      providerErrors: result.providerErrors,
      zoneErrors: result.providerErrors.length > 0 ? 1 : 0,
      truncated: result.truncated,
      recent30d: recentCount,
      observations: filtered.length,
      isCached: false,
    })

    const qualityNotes: string[] = []
    if (aggregate.obscured_count > 0) {
      qualityNotes.push(`${aggregate.obscured_count} registro(s) con coordenadas generalizadas u ocultas.`)
    }
    if (aggregate.unknown_license_count > 0) {
      qualityNotes.push(`${aggregate.unknown_license_count} registro(s) con licencia desconocida.`)
    }
    if (filtered.length < 15) {
      qualityNotes.push('Muestra pequeña; puede reflejar bajo esfuerzo de muestreo.')
    }

    return {
      generated_at: new Date().toISOString(),
      zone_code: zone.code,
      zone_name: zone.name,
      region_label: zone.regionLabel,
      centroid: { lat: zone.latitude, lng: zone.longitude },
      radius_km: Math.round(zone.radiusM / 1000),
      data_status: dataStatus,
      summary: {
        species_count: aggregate.unique_species,
        observations_count: filtered.length,
        recent_count: recentCount,
        research_grade_count: aggregate.research_grade_count,
        generalized_count: aggregate.obscured_count,
        narrative: buildZoneBiodiversityNarrative({
          zoneName: zone.name,
          speciesCount: aggregate.unique_species,
          observationsCount: filtered.length,
          recentCount,
          periodLabel: PERIOD_LABELS[filters.period],
        }),
      },
      taxonomic_distribution: taxonomicDistribution,
      activity,
      quality: {
        coordinate_completeness_pct:
          filtered.length > 0
            ? Math.round((aggregate.coordinates_exposed_count / filtered.length) * 100)
            : 0,
        research_grade_pct:
          filtered.length > 0
            ? Math.round((aggregate.research_grade_count / filtered.length) * 100)
            : 0,
        obscured_count: aggregate.obscured_count,
        captive_count: aggregate.captive_count,
        unknown_license_count: aggregate.unknown_license_count,
        possible_duplicate_count: aggregate.possible_duplicate_count,
        notes: qualityNotes,
      },
      sources: buildSources(filtered, health),
      disclaimer: BIODIVERSITY_CONFIG.disclaimer,
      filters_applied: filters,
    }
  }

  private zonesForFilters(filters: BiodiversityDashboardFilters): BiodiversityMonitoredZone[] {
    if (filters.zone !== 'all') {
      const zone = getBiodiversityZoneByCode(filters.zone)
      return zone ? [zone] : []
    }
    return getEnabledBiodiversityZones()
  }

  private async fetchZones(
    zones: BiodiversityMonitoredZone[],
    filters: BiodiversityDashboardFilters,
  ): Promise<ZoneFetchResult[]> {
    return mapWithConcurrency(zones, 2, async (zone) => this.fetchZone(zone, filters))
  }

  private async fetchZone(
    zone: BiodiversityMonitoredZone,
    filters: BiodiversityDashboardFilters,
  ): Promise<ZoneFetchResult> {
    const providerErrors: BiodiversityProviderId[] = []
    let truncated = false
    const providers = providersFromSource(filters.source)

    try {
      const result = await this.biodiversityService.searchOccurrences({
        latitude: zone.latitude,
        longitude: zone.longitude,
        radiusM: zone.radiusM,
        observedFrom: periodToObservedFrom(filters.period),
        providers,
        qualityFilters: qualityFiltersFromDashboard(filters.quality),
        limit: BIODIVERSITY_CONFIG.maxLimit,
        mode: 'summary',
      })

      for (const [, providerResult] of Object.entries(result.byProvider)) {
        if (providerResult?.truncated) truncated = true
      }

      return {
        zone,
        occurrences: result.items,
        providerErrors,
        truncated,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.toLowerCase().includes('gbif') || providers?.includes('gbif')) {
        providerErrors.push('gbif')
      }
      if (msg.toLowerCase().includes('inaturalist') || providers?.includes('inaturalist')) {
        providerErrors.push('inaturalist')
      }
      if (providerErrors.length === 0) {
        providerErrors.push('gbif', 'inaturalist')
      }
      return { zone, occurrences: [], providerErrors, truncated: false }
    }
  }
}

let singleton: BiodiversityDashboardService | null = null

export function getBiodiversityDashboardService(): BiodiversityDashboardService {
  if (!singleton) singleton = new BiodiversityDashboardService()
  return singleton
}

/** Expuesto para pruebas. */
export function createBiodiversityDashboardService(
  service: BiodiversityService,
): BiodiversityDashboardService {
  return new BiodiversityDashboardService(service)
}

// Re-export helpers for unit tests
export const __test = {
  matchesTaxonFilter,
  matchesQualityFilter,
  filterOccurrences,
  buildTaxonomicDistribution,
  resolveDataStatus,
}
