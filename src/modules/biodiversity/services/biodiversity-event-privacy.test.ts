import { describe, expect, it } from 'vitest'

import type { BiodiversityOccurrence } from '../biodiversity.types'
import {
  classifySpatialPrivacy,
  isSpatiallyEligibleForRadius,
} from './biodiversity-event-privacy'
import type { BiodiversityAnalysisPoint } from './biodiversity-event-spatial'

function occ(partial: Partial<BiodiversityOccurrence>): BiodiversityOccurrence {
  return {
    source: 'gbif',
    sourceOccurrenceId: '1',
    scientificName: 'Test sp.',
    coordinatesObscured: false,
    privacyLevel: 'public_exact',
    recordKind: 'recent_observation',
    sourceUrl: 'https://example.com',
    fetchedAt: new Date().toISOString(),
    qualityWarnings: [],
    possibleDuplicate: false,
    ...partial,
  }
}

const point: BiodiversityAnalysisPoint = {
  latitude: 14.5,
  longitude: -90.5,
  geometrySource: 'detections_union',
  detectionCount: 2,
  maxSpreadM: 200,
}

describe('biodiversity-event-privacy', () => {
  it('classifies privacy levels', () => {
    expect(classifySpatialPrivacy(occ({ privacyLevel: 'public_exact' }))).toBe('exact')
    expect(classifySpatialPrivacy(occ({ privacyLevel: 'private_unavailable' }))).toBe('private')
    expect(
      classifySpatialPrivacy(occ({ coordinatesObscured: true, privacyLevel: 'sensitive_generalized' })),
    ).toBe('obscured')
  })

  it('excludes records when uncertainty exceeds radius', () => {
    const wide = occ({ coordinateUncertaintyM: 5000, latitude: 14.5, longitude: -90.5 })
    expect(isSpatiallyEligibleForRadius(wide, 1000, point)).toBe(false)
  })

  it('excludes private records from radius aggregates', () => {
    expect(isSpatiallyEligibleForRadius(occ({ privacyLevel: 'private_unavailable' }), 10000, point)).toBe(
      false,
    )
  })

  it('includes exact records within radius', () => {
    expect(
      isSpatiallyEligibleForRadius(
        occ({ latitude: 14.501, longitude: -90.501, coordinateUncertaintyM: 30 }),
        1000,
        point,
      ),
    ).toBe(true)
  })
})
