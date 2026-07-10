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

  it('strips internal fields from public dto', () => {
    const occ: BiodiversityOccurrence = {
      source: 'gbif',
      sourceOccurrenceId: '1',
      scientificName: 'Test',
      coordinatesObscured: false,
      privacyLevel: 'public_exact',
      sourceUrl: 'https://gbif.org/occurrence/1',
      recordKind: 'human_observation',
      possibleDuplicate: false,
      fetchedAt: '2026-01-01T00:00:00.000Z',
      qualityWarnings: [],
      sourceDatasetId: 'secret-dataset',
    }
    const dto = toPublicOccurrenceDto(occ)
    expect(dto).not.toHaveProperty('sourceDatasetId')
    expect(dto.source).toBe('gbif')
  })
})
