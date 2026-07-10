import { describe, expect, it } from 'vitest'
import type { BiodiversityOccurrence } from './biodiversity.types'
import {
  buildNormalizedTaxonomicDistribution,
  resolveBiodiversityTaxonGroup,
} from './biodiversity-taxon-groups'

function occ(overrides: Partial<BiodiversityOccurrence>): BiodiversityOccurrence {
  return {
    source: 'gbif',
    sourceOccurrenceId: '1',
    scientificName: 'sp',
    coordinatesObscured: false,
    privacyLevel: 'public_exact',
    sourceUrl: 'https://example.com',
    recordKind: 'human_observation',
    possibleDuplicate: false,
    fetchedAt: '2026-07-01T00:00:00.000Z',
    qualityWarnings: [],
    ...overrides,
  }
}

describe('biodiversity-taxon-groups', () => {
  it('maps kingdom and class to exclusive friendly groups', () => {
    expect(resolveBiodiversityTaxonGroup(occ({ kingdom: 'Plantae' }))).toBe('plants')
    expect(resolveBiodiversityTaxonGroup(occ({ className: 'Aves' }))).toBe('birds')
    expect(resolveBiodiversityTaxonGroup(occ({ className: 'Insecta' }))).toBe('insects')
    expect(resolveBiodiversityTaxonGroup(occ({ className: 'Actinopterygii' }))).toBe('fish')
  })

  it('sums to total occurrence count', () => {
    const sample = [
      occ({ kingdom: 'Plantae' }),
      occ({ className: 'Aves' }),
      occ({ className: 'Insecta' }),
      occ({ kingdom: 'Fungi' }),
    ]
    const dist = buildNormalizedTaxonomicDistribution(sample)
    const total = Object.values(dist).reduce((a, b) => a + b, 0)
    expect(total).toBe(4)
  })
})
