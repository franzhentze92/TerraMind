import { describe, expect, it } from 'vitest'
import { buildBiodiversityZoneSummary } from './biodiversity-summary'
import type { BiodiversityOccurrence } from './biodiversity.types'

function occ(overrides: Partial<BiodiversityOccurrence>): BiodiversityOccurrence {
  return {
    source: 'inaturalist',
    sourceOccurrenceId: '1',
    scientificName: 'Quetzal',
    coordinatesObscured: false,
    privacyLevel: 'public_exact',
    sourceUrl: 'https://example.com/1',
    recordKind: 'citizen_science_observation',
    possibleDuplicate: false,
    fetchedAt: '2026-01-01T00:00:00.000Z',
    qualityWarnings: [],
    observedAt: new Date().toISOString(),
    kingdom: 'Aves',
    ...overrides,
  }
}

describe('biodiversity-summary', () => {
  it('builds rule-based narrative without conservation claims', () => {
    const summary = buildBiodiversityZoneSummary({
      zoneName: 'Zona prueba',
      radiusKm: 10,
      occurrences: [occ({}), occ({ scientificName: 'Ocelot' })],
      combinedDeduplicatedCount: 2,
      crossProviderDuplicatePairs: 0,
      generatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(summary.narrative).toContain('especie')
    expect(summary.metrics.conservation_interest_note).toContain('no hay integración UICN')
  })
})
