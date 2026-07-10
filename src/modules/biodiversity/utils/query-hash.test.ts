import { describe, expect, it } from 'vitest'
import { buildBiodiversityQueryHash } from './query-hash'

describe('query-hash', () => {
  it('is deterministic for same inputs', () => {
    const query = { latitude: 14.5, longitude: -90.8, radiusM: 5000, limit: 20 }
    const a = buildBiodiversityQueryHash('gbif', query)
    const b = buildBiodiversityQueryHash('gbif', query)
    expect(a).toBe(b)
  })

  it('differs by provider', () => {
    const query = { latitude: 14.5, longitude: -90.8, radiusM: 5000 }
    expect(buildBiodiversityQueryHash('gbif', query)).not.toBe(
      buildBiodiversityQueryHash('inaturalist', query),
    )
  })
})
