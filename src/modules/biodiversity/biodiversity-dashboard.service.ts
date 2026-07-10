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
  buildNationalBiodiversityCardNarrative,
  buildZoneBiodiversityNarrative,
} from './biodiversity-dashboard-narrative'
import {
  BIODIVERSITY_TAXON_GROUP_KEYS,
  BIODIVERSITY_TAXON_GROUP_LABELS,
  buildNormalizedTaxonomicDistribution,
  topNormalizedTaxonGroups,
} from './biodiversity-taxon-groups'
import type {
  BiodiversityDashboardActivity,
  BiodiversityDashboardDataStatus,
  BiodiversityDashboardFilters,
  BiodiversityDashboardQualitySummary,
  BiodiversityDashboardSourceItem,
  BiodiversityDashboardSummaryDto,
  BiodiversityDashboardZoneItem,
  BiodiversityPeriod,
  BiodiversityQualityFilter,
  BiodiversitySourceFilter,
  BiodiversityTaxonFilter,
  BiodiversityZoneCoverageLabel,
  BiodiversityZoneDetailDto,
  BiodiversityZonesListDto,
} from './dto/biodiversity-dashboard.dto'
import { periodToObservedFrom } from './dto/biodiversity-dashboard.dto'
import { getBiodiversityService, type BiodiversityService } from './biodiversity.service'
import { getCached, setCached } from './utils/cache'
import { mapWithConcurrency } from './utils/concurrency'

const DASHBOARD_CACHE_TTL_MS = 15 * 60 * 1000
const RECENT_30D_MS = 30 * 24 * 60 * 60 * 1000
const ACTIVITY_WEEKS = 12

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

function weekStartMonday(d: Date): Date {
  const copy = new Date(d)
  const day = copy.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setUTCDate(copy.getUTCDate() + diff)
  copy.setUTCHours(0, 0, 0, 0)
  return copy
}

function formatWeekLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })
}

function buildActivity(
  occurrences: BiodiversityOccurrence[],
  truncated: boolean,
  now = Date.now(),
): BiodiversityDashboardActivity {
  const weeks: BiodiversityDashboardActivity['by_week'] = []
  const start = weekStartMonday(new Date(now))
  start.setUTCDate(start.getUTCDate() - (ACTIVITY_WEEKS - 1) * 7)

  for (let i = 0; i < ACTIVITY_WEEKS; i++) {
    const weekStart = new Date(start)
    weekStart.setUTCDate(start.getUTCDate() + i * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7)
    const iso = weekStart.toISOString().slice(0, 10)

    let gbif = 0
    let inaturalist = 0
    for (const occ of occurrences) {
      const t = parseObservedAt(occ.observedAt)
      if (t === null || t < weekStart.getTime() || t >= weekEnd.getTime()) continue
      if (occ.source === 'gbif') gbif += 1
      else if (occ.source === 'inaturalist') inaturalist += 1
    }
    weeks.push({
      week_start: iso,
      label: formatWeekLabel(iso),
      gbif,
      inaturalist,
      total: gbif + inaturalist,
    })
  }

  return {
    by_week: weeks,
    selected_period_count: occurrences.length,
    recent_30d_count: countRecent(occurrences, RECENT_30D_MS, now),
    truncated,
  }
}

function buildTaxonomicDistributionUi(
  occurrences: BiodiversityOccurrence[],
): Record<string, number> {
  const normalized = buildNormalizedTaxonomicDistribution(occurrences)
  const dist: Record<string, number> = {}
  for (const key of BIODIVERSITY_TAXON_GROUP_KEYS) {
    if (normalized[key] > 0) {
      dist[BIODIVERSITY_TAXON_GROUP_LABELS[key]] = normalized[key]
    }
  }
  return dist
}

function buildQualitySummary(
  aggregate: ReturnType<typeof buildBiodiversitySearchAggregate>,
  truncated: boolean,
  total: number,
): BiodiversityDashboardQualitySummary {
  const notes: string[] = []
  if (aggregate.obscured_count > 0) {
    notes.push(`${aggregate.obscured_count} registro(s) con ubicación generalizada u oculta.`)
  }
  if (aggregate.unknown_license_count > 0) {
    notes.push(`${aggregate.unknown_license_count} registro(s) con licencia desconocida.`)
  }
  if (truncated) {
    notes.push('La muestra alcanzó el límite por zona; los totales pueden ser un piso, no un inventario.')
  }
  if (total < 20) {
    notes.push('Muestra pequeña; la densidad refleja esfuerzo de observación, no biodiversidad total.')
  }

  return {
    coordinate_completeness_pct:
      total > 0 ? Math.round((aggregate.coordinates_present_count / total) * 100) : 0,
    coordinates_present_count: aggregate.coordinates_present_count,
    inaturalist_research_grade:
      aggregate.inaturalist_total_count > 0
        ? {
            count: aggregate.inaturalist_research_grade_count,
            total: aggregate.inaturalist_total_count,
          }
        : null,
    obscured_count: aggregate.obscured_count,
    captive_count: aggregate.captive_count,
    unknown_license_count: aggregate.unknown_license_count,
    possible_duplicate_count: aggregate.possible_duplicate_count,
    truncated,
    notes,
  }
}

function resolveCoverageLabel(input: {
  observations: number
  truncated: boolean
  partial: boolean
}): BiodiversityZoneCoverageLabel {
  if (input.truncated || input.partial) return 'parcial'
  if (input.observations < 10) return 'limitada'
  if (input.observations < 40) return 'media'
  return 'alta'
}

function buildSources(
  occurrences: BiodiversityOccurrence[],
  health: Awaited<ReturnType<BiodiversityService['getSystemHealth']>>,
  providerErrors: Partial<Record<BiodiversityProviderId, string>> = {},
): BiodiversityDashboardSourceItem[] {
  const providers: BiodiversityProviderId[] = ['gbif', 'inaturalist']
  return providers.map((provider) => {
    const records = occurrences.filter((o) => o.source === provider).length
    const reachable =
      provider === 'gbif' ? health.gbif_reachable : health.inaturalist_reachable
    const failed = Boolean(providerErrors[provider])
    let status: BiodiversityDashboardSourceItem['status'] = 'ok'
    if (failed || !reachable) status = 'unavailable'
    else if (records === 0) status = 'no_data'
    return {
      provider,
      records,
      reachable,
      last_success: health.last_success_by_provider[provider] ?? null,
      status,
    }
  })
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
      if (cached) {
        return {
          ...cached,
          is_cached: true,
          data_status: cached.data_status === 'success' ? 'stale' : cached.data_status,
        }
      }
    }

    const zones = this.zonesForFilters(filters)
    const health = await this.biodiversityService.getSystemHealth()
    const zoneResults = await this.fetchZones(zones, filters)

    const allOccurrences = zoneResults.flatMap((r) => r.occurrences)
    const { accepted } = partitionAcceptedOccurrences(allOccurrences)
    const filtered = filterOccurrences(accepted, filters)
    const aggregate = buildBiodiversitySearchAggregate(filtered)
    const providerErrors = [...new Set(zoneResults.flatMap((r) => r.providerErrors))]
    const zoneErrors = zoneResults.filter((r) => r.providerErrors.length > 0).length
    const truncated = zoneResults.some((r) => r.truncated)
    const activity = buildActivity(filtered, truncated)
    const taxonomicDistribution = buildTaxonomicDistributionUi(filtered)
    const quality = buildQualitySummary(aggregate, truncated, filtered.length)
    const periodLabel = PERIOD_LABELS[filters.period]

    const zoneItems: BiodiversityDashboardZoneItem[] = zoneResults.map((result) => {
      const { accepted: zoneAccepted } = partitionAcceptedOccurrences(result.occurrences)
      const zoneFiltered = filterOccurrences(zoneAccepted, filters)
      const zoneAgg = buildBiodiversitySearchAggregate(zoneFiltered)
      const zoneDist = buildNormalizedTaxonomicDistribution(zoneFiltered)
      const zoneRecent = countRecent(zoneFiltered, RECENT_30D_MS)
      const zonePartial = result.providerErrors.length > 0
      const lowCoverage = zoneFiltered.length < 15
      const zoneStatus = resolveDataStatus({
        providerErrors: result.providerErrors,
        zoneErrors: zonePartial ? 1 : 0,
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
        research_grade_pct:
          zoneAgg.inaturalist_total_count > 0
            ? Math.round(
                (zoneAgg.inaturalist_research_grade_count / zoneAgg.inaturalist_total_count) * 100,
              )
            : null,
        generalized_count: zoneAgg.obscured_count,
        top_taxonomic_groups: topNormalizedTaxonGroups(zoneDist),
        coverage_label: resolveCoverageLabel({
          observations: zoneFiltered.length,
          truncated: result.truncated,
          partial: zonePartial,
        }),
        source_distribution: {
          gbif: zoneAgg.by_provider.gbif ?? 0,
          inaturalist: zoneAgg.by_provider.inaturalist ?? 0,
        },
        data_status: zoneStatus,
        narrative: buildZoneBiodiversityNarrative({
          zoneName: result.zone.name,
          speciesCount: zoneAgg.unique_species,
          observationsCount: zoneFiltered.length,
          recentCount: zoneRecent,
          periodLabel,
          truncated: result.truncated,
          lowCoverage,
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
      recent30d: activity.recent_30d_count,
      observations: filtered.length,
      isCached: false,
    })

    const dto: BiodiversityDashboardSummaryDto = {
      generated_at: new Date().toISOString(),
      data_status: dataStatus,
      national_summary: {
        species_count: aggregate.unique_species,
        observations_count: filtered.length,
        recent_30d_count: activity.recent_30d_count,
        zones_monitored: zones.length,
        sources_active: sourcesActive,
        generalized_count: aggregate.obscured_count,
        period_label: periodLabel,
        selected_period_observations_count: filtered.length,
        truncated,
        observations_at_least: truncated ? filtered.length : undefined,
        narrative: buildNationalBiodiversityNarrative({
          speciesCount: aggregate.unique_species,
          observationsCount: filtered.length,
          recent30d: activity.recent_30d_count,
          zonesMonitored: zones.length,
          topZoneName: topZone?.zone_name ?? null,
          topZoneSpecies: topZone?.species_count ?? 0,
          generalizedCount: aggregate.obscured_count,
          dataStatus,
          periodLabel,
          truncated,
        }),
        card_narrative: buildNationalBiodiversityCardNarrative({
          speciesCount: aggregate.unique_species,
          observationsCount: filtered.length,
          zonesMonitored: zones.length,
          truncated,
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
      quality,
      sources: buildSources(
        filtered,
        health,
        Object.fromEntries(providerErrors.map((p) => [p, 'unavailable'])) as Partial<
          Record<BiodiversityProviderId, string>
        >,
      ),
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
    const activity = buildActivity(filtered, result.truncated)
    const taxonomicDistribution = buildTaxonomicDistributionUi(filtered)
    const recentCount = countRecent(filtered, RECENT_30D_MS)
    const periodLabel = PERIOD_LABELS[filters.period]
    const lowCoverage = filtered.length < 15

    const dataStatus = resolveDataStatus({
      providerErrors: result.providerErrors,
      zoneErrors: result.providerErrors.length > 0 ? 1 : 0,
      truncated: result.truncated,
      recent30d: recentCount,
      observations: filtered.length,
      isCached: false,
    })

    const quality = buildQualitySummary(aggregate, result.truncated, filtered.length)

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
        research_grade_count: aggregate.inaturalist_research_grade_count,
        generalized_count: aggregate.obscured_count,
        narrative: buildZoneBiodiversityNarrative({
          zoneName: zone.name,
          speciesCount: aggregate.unique_species,
          observationsCount: filtered.length,
          recentCount,
          periodLabel,
          truncated: result.truncated,
          lowCoverage,
        }),
      },
      taxonomic_distribution: taxonomicDistribution,
      activity,
      quality,
      sources: buildSources(filtered, health, result.providerErrors),
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

    for (const [provider, message] of Object.entries(result.providerErrors)) {
      if (message) providerErrors.push(provider as BiodiversityProviderId)
    }

    for (const [, providerResult] of Object.entries(result.byProvider)) {
      if (providerResult?.truncated) truncated = true
    }
    if (result.items.length >= BIODIVERSITY_CONFIG.maxLimit) truncated = true

    return {
      zone,
      occurrences: result.items,
      providerErrors,
      truncated,
    }
  }
}

let singleton: BiodiversityDashboardService | null = null

export function getBiodiversityDashboardService(): BiodiversityDashboardService {
  if (!singleton) singleton = new BiodiversityDashboardService()
  return singleton
}

export function createBiodiversityDashboardService(
  service: BiodiversityService,
): BiodiversityDashboardService {
  return new BiodiversityDashboardService(service)
}

export const __test = {
  matchesTaxonFilter,
  matchesQualityFilter,
  filterOccurrences,
  buildTaxonomicDistributionUi,
  resolveDataStatus,
  resolveCoverageLabel,
  buildQualitySummary,
  buildActivity,
}
