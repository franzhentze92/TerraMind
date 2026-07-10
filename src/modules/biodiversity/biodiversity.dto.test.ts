import { describe, expect, it } from 'vitest'
import { parseBiodiversitySearchQuery, toPublicOccurrenceDto } from './biodiversity.dto'
import type { BiodiversityOccurrence } from './biodiversity.types'

describe('biodiversity.dto', () => {
  it('rejects missing geo params', () => {
    const parsed = parseBiodiversitySearchQuery(new URLSearchParams({ limit: '10' }))
    expect(parsed.ok).toBe(false)
  })

  it('rejects radius above max', () => {
    const parsed = parseBiodiversitySearchQuery(
      new URLSearchParams({ lat: '14', lng: '-90', radius_m: '999999' }),
    )
    expect(parsed.ok).toBe(false)
  })

  it('strips coordinates when privacy is not public_exact', () => {
    const occ: BiodiversityOccurrence = {
      source: 'inaturalist',
      sourceOccurrenceId: '1',
      scientificName: 'Test',
      coordinatesObscured: true,
      privacyLevel: 'sensitive_generalized',
      latitude: 14.5,
      longitude: -90.8,
      sourceUrl: 'https://example.com',
      recordKind: 'citizen_science_observation',
      possibleDuplicate: false,
      fetchedAt: '2026-01-01T00:00:00.000Z',
      qualityWarnings: [],
    }
    const dto = toPublicOccurrenceDto(occ)
    expect(dto).not.toHaveProperty('latitude')
    expect(dto).not.toHaveProperty('longitude')
  })
})
