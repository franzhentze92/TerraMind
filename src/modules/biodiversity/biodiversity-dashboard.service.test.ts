import { describe, expect, it, vi } from 'vitest'
import type { BiodiversityOccurrence } from './biodiversity.types'
import {
  __test,
  createBiodiversityDashboardService,
} from './biodiversity-dashboard.service'
import type { BiodiversityService } from './biodiversity.service'

function occ(overrides: Partial<BiodiversityOccurrence>): BiodiversityOccurrence {
  return {
    source: 'gbif',
    sourceOccurrenceId: '1',
    scientificName: 'Turdus migratorius',
    coordinatesObscured: false,
    privacyLevel: 'public_exact',
    latitude: 14.5,
    longitude: -90.5,
    sourceUrl: 'https://example.com/1',
    recordKind: 'human_observation',
    possibleDuplicate: false,
    fetchedAt: '2026-07-01T00:00:00.000Z',
    qualityWarnings: [],
    observedAt: '2026-06-15T00:00:00.000Z',
    className: 'Aves',
    kingdom: 'Animalia',
    ...overrides,
  }
}

function mockService(
  occurrences: BiodiversityOccurrence[],
  overrides: Partial<BiodiversityService> = {},
): BiodiversityService {
  return {
    searchOccurrences: vi.fn().mockResolvedValue({
      items: occurrences,
      byProvider: { gbif: { truncated: false } },
      quality: [],
      generatedAt: new Date().toISOString(),
      disclaimer: 'test',
      deduplicatedCount: 0,
    }),
    searchOccurrencesPublic: vi.fn(),
    resolveTaxon: vi.fn(),
    getSystemHealth: vi.fn().mockResolvedValue({
      gbif_reachable: true,
      inaturalist_reachable: true,
      database_reachable: false,
      cache_status: 'cold',
      last_success_by_provider: { gbif: '2026-07-10T00:00:00.000Z' },
      consecutive_failures: {},
      rate_limit_state: {},
      generated_at: new Date().toISOString(),
    }),
    ...overrides,
  } as unknown as BiodiversityService
}

describe('biodiversity-dashboard.service', () => {
  it('filters by taxon group', () => {
    const birds = occ({ className: 'Aves' })
    const plants = occ({ scientificName: 'Quercus', kingdom: 'Plantae', className: undefined })
    expect(__test.matchesTaxonFilter(birds, 'birds')).toBe(true)
    expect(__test.matchesTaxonFilter(plants, 'birds')).toBe(false)
    expect(__test.matchesTaxonFilter(plants, 'plants')).toBe(true)
  })

  it('aggregates dashboard without occurrence coordinates in DTO', async () => {
    const service = createBiodiversityDashboardService(
      mockService([occ({}), occ({ scientificName: 'Plantae sp', kingdom: 'Plantae', className: undefined })]),
    )
    const dto = await service.getDashboardSummary(
      { period: '30d', source: 'all', taxon: 'all', quality: 'all', zone: 'maya' },
      { skipCache: true },
    )

    expect(dto.national_summary.species_count).toBe(2)
    expect(dto.zones.length).toBe(1)
    expect(dto.zones[0].zone_code).toBe('maya')
    expect(dto.zones[0].centroid).toEqual({ lat: 17.22, lng: -89.63 })
    const serialized = JSON.stringify(dto)
    expect(serialized).not.toContain('"latitude"')
    expect(serialized).not.toContain('source_occurrence_id')
  })

  it('marks partial when providers fail', async () => {
    const service = createBiodiversityDashboardService(
      mockService([], {
        searchOccurrences: vi.fn().mockRejectedValue(new Error('gbif timeout')),
      }),
    )
    const dto = await service.getDashboardSummary(
      { period: '30d', source: 'all', taxon: 'all', quality: 'all', zone: 'maya' },
      { skipCache: true },
    )
    expect(['partial', 'providers_unavailable']).toContain(dto.data_status)
    expect(dto.national_summary.observations_count).toBe(0)
  })

  it('lists configured zones', () => {
    const service = createBiodiversityDashboardService(mockService([]))
    const list = service.listZones()
    expect(list.zones.length).toBeGreaterThanOrEqual(3)
    expect(list.zones.some((z) => z.zone_code === 'acatenango')).toBe(true)
  })

  it('returns zone detail for valid code', async () => {
    const service = createBiodiversityDashboardService(mockService([occ({})]))
    const detail = await service.getZoneSummary('maya', {
      period: '90d',
      source: 'all',
      taxon: 'all',
      quality: 'all',
      zone: 'all',
    })
    expect(detail?.zone_code).toBe('maya')
    expect(detail?.quality.notes).toBeDefined()
  })

  it('returns null for unknown zone', async () => {
    const service = createBiodiversityDashboardService(mockService([]))
    const detail = await service.getZoneSummary('unknown', {
      period: '30d',
      source: 'all',
      taxon: 'all',
      quality: 'all',
      zone: 'all',
    })
    expect(detail).toBeNull()
  })
})
