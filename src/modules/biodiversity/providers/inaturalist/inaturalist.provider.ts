import type { BiodiversitySearchQuery } from '../../biodiversity.types'
import { BIODIVERSITY_CONFIG } from '../../config/biodiversity.config'
import { buildBiodiversityQueryHash } from '../../utils/query-hash'
import { getCached, setCached } from '../../utils/cache'
import type { BiodiversityProvider } from '../../biodiversity-provider.interface'
import type {
  BiodiversityOccurrence,
  BiodiversityProviderHealth,
  BiodiversitySearchResult,
  BiodiversityTaxon,
  BiodiversityTaxonResolveInput,
} from '../../biodiversity.types'
import { inaturalistFetchJson } from './inaturalist.client'
import {
  decodeInatCursor,
  encodeInatCursor,
  mapInaturalistObservation,
  mapInaturalistTaxon,
} from './inaturalist.mapper'
import type {
  InatObservation,
  InatObservationSearchResponse,
  InatTaxonSearchResponse,
} from './inaturalist.types'
import { InaturalistApiError } from './inaturalist.types'

function buildInatSearchParams(query: BiodiversitySearchQuery, page: number, perPage: number) {
  const params: Record<string, string | number | boolean | undefined> = {
    page,
    per_page: perPage,
    geo: true,
    order: 'desc',
    order_by: 'observed_on',
  }

  if (query.taxonId) params.taxon_id = query.taxonId
  if (query.scientificName) params.taxon_name = query.scientificName
  if (query.observedFrom) params.d1 = query.observedFrom.slice(0, 10)
  if (query.observedTo) params.d2 = query.observedTo.slice(0, 10)

  if (
    query.latitude !== undefined &&
    query.longitude !== undefined &&
    query.radiusM !== undefined
  ) {
    params.lat = query.latitude
    params.lng = query.longitude
    params.radius = Math.min(query.radiusM / 1000, BIODIVERSITY_CONFIG.maxRadiusM / 1000)
  }

  if (query.qualityFilters?.researchGradeOnly) {
    params.quality_grade = 'research'
  } else if (query.qualityFilters?.excludeCaptiveCultivated) {
    params.quality_grade = 'research,needs_id'
  }

  if (query.qualityFilters?.excludeCaptiveCultivated) {
    params.captive = false
  }

  return params
}

export class InaturalistBiodiversityProvider implements BiodiversityProvider {
  readonly id = 'inaturalist' as const

  async searchOccurrences(query: BiodiversitySearchQuery): Promise<BiodiversitySearchResult> {
    const page = decodeInatCursor(query.cursor)
    const perPage = Math.min(query.limit ?? 50, BIODIVERSITY_CONFIG.inaturalist.maxPageSize)
    const queryHash = buildBiodiversityQueryHash('inaturalist', query, String(page))
    const cacheKey = `inat:search:${queryHash}`
    const cached = getCached<BiodiversitySearchResult>(cacheKey)
    if (cached) return cached

    const fetchedAt = new Date().toISOString()
    const params = buildInatSearchParams(query, page, perPage)
    const response = await inaturalistFetchJson<InatObservationSearchResponse>(
      '/observations',
      params,
      'inat-observation-search',
    )

    const occurrences = response.results.map((r) => mapInaturalistObservation(r, fetchedAt))
    const hasMore =
      response.results.length === perPage &&
      page * perPage < response.total_results &&
      page < BIODIVERSITY_CONFIG.inaturalist.maxPage
    const truncated =
      page * perPage >= BIODIVERSITY_CONFIG.maxSearchRecordsPerQuery ||
      page >= BIODIVERSITY_CONFIG.inaturalist.maxPage

    const result: BiodiversitySearchResult = {
      occurrences,
      nextCursor: hasMore && !truncated ? encodeInatCursor(page + 1) : undefined,
      totalEstimate: response.total_results,
      provider: 'inaturalist',
      queryHash,
      fetchedAt,
      truncated,
      disclaimer: BIODIVERSITY_CONFIG.disclaimer,
    }

    setCached(
      cacheKey,
      result,
      BIODIVERSITY_CONFIG.cache.inaturalistSearchTtlHours * 60 * 60 * 1000,
    )
    return result
  }

  async getOccurrence(id: string): Promise<BiodiversityOccurrence | null> {
    const fetchedAt = new Date().toISOString()
    const response = await inaturalistFetchJson<InatObservationSearchResponse>(
      '/observations',
      { id },
      'inat-observation-get',
    )
    const obs = response.results[0]
    return obs ? mapInaturalistObservation(obs, fetchedAt) : null
  }

  async resolveTaxon(input: BiodiversityTaxonResolveInput): Promise<BiodiversityTaxon | null> {
    if (input.taxonId) return this.getTaxon(input.taxonId)
    if (!input.scientificName) return null

    const cacheKey = `inat:taxon:match:${input.scientificName.toLowerCase()}`
    const cached = getCached<BiodiversityTaxon>(cacheKey)
    if (cached) return cached

    const fetchedAt = new Date().toISOString()
    const response = await inaturalistFetchJson<InatTaxonSearchResponse>(
      '/taxa',
      { q: input.scientificName, per_page: 1, is_active: true },
      'inat-taxon-match',
    )
    const taxon = response.results[0] ? mapInaturalistTaxon(response.results[0], fetchedAt) : null
    if (taxon) {
      setCached(
        cacheKey,
        taxon,
        BIODIVERSITY_CONFIG.cache.taxonTtlDays * 24 * 60 * 60 * 1000,
      )
    }
    return taxon
  }

  async getTaxon(id: string): Promise<BiodiversityTaxon | null> {
    const cacheKey = `inat:taxon:${id}`
    const cached = getCached<BiodiversityTaxon>(cacheKey)
    if (cached) return cached

    const fetchedAt = new Date().toISOString()
    const response = await inaturalistFetchJson<InatTaxonSearchResponse>(
      '/taxa',
      { id, per_page: 1 },
      'inat-taxon-get',
    )
    const taxon = response.results[0] ? mapInaturalistTaxon(response.results[0], fetchedAt) : null
    if (taxon) {
      setCached(cacheKey, taxon, BIODIVERSITY_CONFIG.cache.taxonTtlDays * 24 * 60 * 60 * 1000)
    }
    return taxon
  }

  async healthCheck(): Promise<BiodiversityProviderHealth> {
    const cacheKey = 'inat:health'
    const cached = getCached<BiodiversityProviderHealth>(cacheKey)
    if (cached) return cached

    const started = Date.now()
    try {
      await inaturalistFetchJson<InatObservationSearchResponse>(
        '/observations',
        { lat: 14.63, lng: -90.51, radius: 1, per_page: 1 },
        'inat-health',
      )
      const health: BiodiversityProviderHealth = {
        provider: 'inaturalist',
        reachable: true,
        latencyMs: Date.now() - started,
        rateLimitState: 'ok',
        checkedAt: new Date().toISOString(),
      }
      setCached(
        cacheKey,
        health,
        BIODIVERSITY_CONFIG.cache.healthTtlMinutes * 60 * 1000,
      )
      return health
    } catch (err) {
      return {
        provider: 'inaturalist',
        reachable: false,
        latencyMs: Date.now() - started,
        rateLimitState:
          err instanceof InaturalistApiError && err.code === 'RATE_LIMIT' ? 'throttled' : 'unknown',
        message: err instanceof Error ? err.message : 'Error desconocido',
        checkedAt: new Date().toISOString(),
      }
    }
  }
}

export function createInaturalistProvider(): BiodiversityProvider {
  return new InaturalistBiodiversityProvider()
}
