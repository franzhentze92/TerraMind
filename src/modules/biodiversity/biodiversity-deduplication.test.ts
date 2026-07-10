import { describe, expect, it } from 'vitest'
import { markBiodiversityDuplicates } from './biodiversity-deduplication'
import type { BiodiversityOccurrence } from './biodiversity.types'

function occ(
  source: 'gbif' | 'inaturalist',
  id: string,
  overrides: Partial<BiodiversityOccurrence> = {},
): BiodiversityOccurrence {
  return {
    source,
    sourceOccurrenceId: id,
    scientificName: 'Panthera onca',
    coordinatesObscured: false,
    privacyLevel: 'public_exact',
    sourceUrl:
      source === 'gbif'
        ? `https://www.inaturalist.org/observations/${id}`
        : `https://www.inaturalist.org/observations/${id}`,
    recordKind: source === 'inaturalist' ? 'citizen_science_observation' : 'human_observation',
    possibleDuplicate: false,
    fetchedAt: '2026-01-01T00:00:00.000Z',
    qualityWarnings: [],
    observedAt: '2024-01-15',
    latitude: 17.12,
    longitude: -90.45,
    ...overrides,
  }
}

describe('biodiversity-deduplication', () => {
  it('marks gbif/inat pairs via inat url in gbif', () => {
    const items = markBiodiversityDuplicates([
      occ('gbif', '100', {
        sourceUrl: 'https://www.inaturalist.org/observations/555',
      }),
      occ('inaturalist', '555'),
    ])
    const dupes = items.filter((i) => i.possibleDuplicate)
    expect(dupes.length).toBe(2)
    expect(dupes.every((d) => d.duplicateGroupId)).toBe(true)
  })

  it('does not remove doubtful records', () => {
    const input = [occ('gbif', '1'), occ('inaturalist', '2')]
    const output = markBiodiversityDuplicates(input)
    expect(output.length).toBe(input.length)
  })
})
