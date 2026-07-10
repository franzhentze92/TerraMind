import type { BiodiversityProvider } from './biodiversity-provider.interface'
import type {
  BiodiversityCombinedSearchResult,
  BiodiversityProviderId,
  BiodiversitySearchQuery,
  BiodiversitySystemHealth,
  BiodiversityTaxon,
  BiodiversityTaxonResolveInput,
} from './biodiversity.types'
import { BIODIVERSITY_CONFIG } from './config/biodiversity.config'
import { markBiodiversityDuplicates } from './biodiversity-deduplication'
import { buildBiodiversityDataQuality } from './biodiversity-quality'
import { toPublicOccurrenceDto } from './biodiversity.dto'
import { createGbifProvider } from './providers/gbif/gbif.provider'
import { createInaturalistProvider } from './providers/inaturalist/inaturalist.provider'
import { mapWithConcurrency } from './utils/concurrency'
import { cacheStatus } from './utils/cache'

const failureCounts: Partial<Record<BiodiversityProviderId, number>> = {}
const lastSuccess: Partial<Record<BiodiversityProviderId, string | null>> = {}

function getProviders(ids?: BiodiversityProviderId[]): BiodiversityProvider[] {
  const all = [createGbifProvider(), createInaturalistProvider()]
  if (!ids?.length) return all
  return all.filter((p) => ids.includes(p.id))
}

function validateSearchQuery(query: BiodiversitySearchQuery): void {
  if (query.radiusM !== undefined && query.radiusM > BIODIVERSITY_CONFIG.maxRadiusM) {
    throw new Error(`Radio máximo ${BIODIVERSITY_CONFIG.maxRadiusM} m`)
  }
  if (query.limit !== undefined && query.limit > BIODIVERSITY_CONFIG.maxLimit) {
    throw new Error(`Límite máximo ${BIODIVERSITY_CONFIG.maxLimit}`)
  }
}

export class BiodiversityService {
  async searchOccurrences(query: BiodiversitySearchQuery): Promise<BiodiversityCombinedSearchResult> {
    validateSearchQuery(query)
    const providers = getProviders(query.providers)
    const limit = Math.min(query.limit ?? 50, BIODIVERSITY_CONFIG.maxLimit)

    const results = await mapWithConcurrency(
      providers,
      BIODIVERSITY_CONFIG.maxConcurrency,
      async (provider) => {
        try {
          const result = await provider.searchOccurrences({ ...query, limit })
          failureCounts[provider.id] = 0
          lastSuccess[provider.id] = new Date().toISOString()
          return result
        } catch (err) {
          failureCounts[provider.id] = (failureCounts[provider.id] ?? 0) + 1
          throw err
        }
      },
    )

    const allOccurrences = results.flatMap((r) => r.occurrences)
    const deduplicated = markBiodiversityDuplicates(allOccurrences).slice(0, limit)

    const byProvider: BiodiversityCombinedSearchResult['byProvider'] = {}
    for (const r of results) byProvider[r.provider] = r

    return {
      items: deduplicated,
      byProvider,
      quality: results.map((r) => buildBiodiversityDataQuality(r.provider, r.occurrences)),
      nextCursor: results.find((r) => r.nextCursor)?.nextCursor,
      deduplicatedCount: deduplicated.filter((o) => o.possibleDuplicate).length,
      generatedAt: new Date().toISOString(),
      disclaimer: BIODIVERSITY_CONFIG.disclaimer,
    }
  }

  async searchOccurrencesPublic(query: BiodiversitySearchQuery) {
    const result = await this.searchOccurrences(query)
    return {
      items: result.items.map(toPublicOccurrenceDto),
      quality: result.quality,
      next_cursor: result.nextCursor,
      deduplicated_count: result.deduplicatedCount,
      generated_at: result.generatedAt,
      disclaimer: result.disclaimer,
    }
  }

  async resolveTaxon(input: BiodiversityTaxonResolveInput): Promise<BiodiversityTaxon | null> {
    const providerId = input.provider ?? 'gbif'
    const provider = getProviders([providerId])[0]
    if (!provider) return null
    return provider.resolveTaxon(input)
  }

  async getSystemHealth(): Promise<BiodiversitySystemHealth> {
    const providers = getProviders()
    const checks = await mapWithConcurrency(providers, 2, (p) => p.healthCheck())

    let databaseReachable = false
    try {
      const { checkBiodiversityDatabaseReachable } = await import('./stores/biodiversity.store')
      databaseReachable = await checkBiodiversityDatabaseReachable()
    } catch {
      databaseReachable = false
    }

    const rateLimitState: BiodiversitySystemHealth['rate_limit_state'] = {}
    for (const check of checks) {
      rateLimitState[check.provider] = check.rateLimitState
    }

    return {
      gbif_reachable: checks.find((c) => c.provider === 'gbif')?.reachable ?? false,
      inaturalist_reachable: checks.find((c) => c.provider === 'inaturalist')?.reachable ?? false,
      database_reachable: databaseReachable,
      cache_status: cacheStatus(),
      last_success_by_provider: { ...lastSuccess },
      consecutive_failures: { ...failureCounts },
      rate_limit_state: rateLimitState,
      generated_at: new Date().toISOString(),
    }
  }
}

let singleton: BiodiversityService | null = null

export function getBiodiversityService(): BiodiversityService {
  if (!singleton) singleton = new BiodiversityService()
  return singleton
}
