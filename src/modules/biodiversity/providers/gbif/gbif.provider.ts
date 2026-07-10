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
import { gbifFetchJson } from './gbif.client'
import {
  decodeGbifCursor,
  encodeGbifCursor,
  mapGbifOccurrence,
  mapGbifSpeciesMatch,
  mapGbifSpeciesRecord,
} from './gbif.mapper'
import type {
  GbifOccurrenceRecord,
  GbifOccurrenceSearchResponse,
  GbifSpeciesMatchResponse,
  GbifSpeciesRecord,
} from './gbif.types'
import { GbifApiError } from './gbif.types'

function bboxFromRadius(lat: number, lng: number, radiusM: number) {
  const latDelta = radiusM / 111_320
  const lngDelta = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180))
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  }
}

function buildGbifSearchParams(query: BiodiversitySearchQuery, offset: number, limit: number) {
  const params: Record<string, string | number | boolean | undefined> = {
    limit,
    offset,
    hasCoordinate: query.qualityFilters?.requireCoordinates !== false,
    occurrenceStatus: 'PRESENT',
  }

  if (query.taxonId) params.taxonKey = query.taxonId
  if (query.scientificName) params.scientificName = query.scientificName
  if (query.observedFrom) params.eventDate = `${query.observedFrom},${query.observedTo ?? '*'}`
  if (query.qualityFilters?.excludeGeospatialIssues) params.hasGeospatialIssue = false

  if (query.geometry) {
    params.geometry = query.geometry
  } else if (
    query.latitude !== undefined &&
    query.longitude !== undefined &&
    query.radiusM !== undefined
  ) {
    const radius = Math.min(query.radiusM, BIODIVERSITY_CONFIG.maxRadiusM)
    const box = bboxFromRadius(query.latitude, query.longitude, radius)
    params.decimalLatitude = `${box.minLat},${box.maxLat}`
    params.decimalLongitude = `${box.minLng},${box.maxLng}`
    params.country = 'GT'
  }

  return params
}

export class GbifBiodiversityProvider implements BiodiversityProvider {
  readonly id = 'gbif' as const

  async searchOccurrences(query: BiodiversitySearchQuery): Promise<BiodiversitySearchResult> {
    const offset = decodeGbifCursor(query.cursor)
    const pageLimit = Math.min(query.limit ?? 50, BIODIVERSITY_CONFIG.gbif.maxPageSize)
    const queryHash = buildBiodiversityQueryHash('gbif', query, String(offset))
    const cacheKey = `gbif:search:${queryHash}`
    const cached = getCached<BiodiversitySearchResult>(cacheKey)
    if (cached) return cached

    const fetchedAt = new Date().toISOString()
    const params = buildGbifSearchParams(query, offset, pageLimit)
    const response = await gbifFetchJson<GbifOccurrenceSearchResponse>(
      { path: '/v1/occurrence/search', searchParams: params },
      'gbif-occurrence-search',
    )

    const occurrences = response.results.map((r) => mapGbifOccurrence(r, fetchedAt))
    const nextOffset = offset + response.results.length
    const truncated =
      !response.endOfRecords &&
      (nextOffset >= BIODIVERSITY_CONFIG.maxSearchRecordsPerQuery ||
        nextOffset + pageLimit > BIODIVERSITY_CONFIG.gbif.maxOffset)

    const result: BiodiversitySearchResult = {
      occurrences,
      nextCursor:
        !response.endOfRecords && !truncated && response.results.length > 0
          ? encodeGbifCursor(nextOffset)
          : undefined,
      totalEstimate: response.count,
      provider: 'gbif',
      queryHash,
      fetchedAt,
      truncated,
      disclaimer: BIODIVERSITY_CONFIG.disclaimer,
    }

    setCached(
      cacheKey,
      result,
      BIODIVERSITY_CONFIG.cache.gbifSearchTtlHours * 60 * 60 * 1000,
    )
    return result
  }

  async getOccurrence(id: string): Promise<BiodiversityOccurrence | null> {
    const fetchedAt = new Date().toISOString()
    try {
      const record = await gbifFetchJson<GbifOccurrenceRecord>(
        { path: `/v1/occurrence/${encodeURIComponent(id)}` },
        'gbif-occurrence-get',
      )
      return mapGbifOccurrence(record, fetchedAt)
    } catch (err) {
      if (err instanceof GbifApiError && err.status === 404) return null
      throw err
    }
  }

  async resolveTaxon(input: BiodiversityTaxonResolveInput): Promise<BiodiversityTaxon | null> {
    if (input.taxonId) return this.getTaxon(input.taxonId)
    if (!input.scientificName) return null

    const cacheKey = `gbif:taxon:match:${input.scientificName.toLowerCase()}`
    const cached = getCached<BiodiversityTaxon>(cacheKey)
    if (cached) return cached

    const fetchedAt = new Date().toISOString()
    const match = await gbifFetchJson<GbifSpeciesMatchResponse>(
      {
        path: '/v2/species/match',
        searchParams: { name: input.scientificName, verbose: true },
      },
      'gbif-species-match',
    )
    const taxon = mapGbifSpeciesMatch(match, fetchedAt)
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
    const cacheKey = `gbif:taxon:${id}`
    const cached = getCached<BiodiversityTaxon>(cacheKey)
    if (cached) return cached

    const fetchedAt = new Date().toISOString()
    try {
      const record = await gbifFetchJson<GbifSpeciesRecord>(
        { path: `/v1/species/${encodeURIComponent(id)}` },
        'gbif-species-get',
      )
      const taxon = mapGbifSpeciesRecord(record, fetchedAt)
      setCached(cacheKey, taxon, BIODIVERSITY_CONFIG.cache.taxonTtlDays * 24 * 60 * 60 * 1000)
      return taxon
    } catch (err) {
      if (err instanceof GbifApiError && err.status === 404) return null
      throw err
    }
  }

  async healthCheck(): Promise<BiodiversityProviderHealth> {
    const cacheKey = 'gbif:health'
    const cached = getCached<BiodiversityProviderHealth>(cacheKey)
    if (cached) return cached

    const started = Date.now()
    try {
      await gbifFetchJson<{ count: number }>(
        { path: '/v1/occurrence/search', searchParams: { country: 'GT', limit: 0 } },
        'gbif-health',
      )
      const health: BiodiversityProviderHealth = {
        provider: 'gbif',
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
        provider: 'gbif',
        reachable: false,
        latencyMs: Date.now() - started,
        rateLimitState: err instanceof GbifApiError && err.code === 'RATE_LIMIT' ? 'throttled' : 'unknown',
        message: err instanceof Error ? err.message : 'Error desconocido',
        checkedAt: new Date().toISOString(),
      }
    }
  }
}

export function createGbifProvider(): BiodiversityProvider {
  return new GbifBiodiversityProvider()
}
