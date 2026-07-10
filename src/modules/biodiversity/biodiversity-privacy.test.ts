import { describe, expect, it } from 'vitest'
import { applyBiodiversityPrivacyPolicy, canExposeExactLocation } from './biodiversity-privacy'
import type { BiodiversityOccurrence } from './biodiversity.types'

function baseOccurrence(overrides: Partial<BiodiversityOccurrence> = {}): BiodiversityOccurrence {
  return {
    source: 'inaturalist',
    sourceOccurrenceId: '1',
    scientificName: 'Test',
    coordinatesObscured: false,
    privacyLevel: 'public_exact',
    sourceUrl: 'https://example.com',
    recordKind: 'citizen_science_observation',
    possibleDuplicate: false,
    fetchedAt: '2026-01-01T00:00:00.000Z',
    qualityWarnings: [],
    ...overrides,
  }
}

describe('biodiversity-privacy', () => {
  it('withholds private locations', () => {
    const result = applyBiodiversityPrivacyPolicy(
      baseOccurrence({ geoprivacy: 'private', latitude: 1, longitude: 2 }),
    )
    expect(result.privacyLevel).toBe('private_unavailable')
    expect(result.latitude).toBeUndefined()
  })

  it('generalizes obscured coordinates', () => {
    const result = applyBiodiversityPrivacyPolicy(
      baseOccurrence({ coordinatesObscured: true, latitude: 14.50123, longitude: -90.87654 }),
    )
    expect(result.privacyLevel).toBe('sensitive_generalized')
    expect(result.latitude).toBe(14.5)
    expect(result.coordinateUncertaintyM).toBeGreaterThanOrEqual(10_000)
  })

  it('canExposeExactLocation only for public_exact', () => {
    expect(canExposeExactLocation('public_exact')).toBe(true)
    expect(canExposeExactLocation('sensitive_generalized')).toBe(false)
  })
})
