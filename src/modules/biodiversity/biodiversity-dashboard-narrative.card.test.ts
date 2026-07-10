import { describe, expect, it } from 'vitest'
import { buildNationalBiodiversityCardNarrative } from './biodiversity-dashboard-narrative'

describe('buildNationalBiodiversityCardNarrative', () => {
  it('compacts truncated sample message', () => {
    const text = buildNationalBiodiversityCardNarrative({
      speciesCount: 572,
      observationsCount: 1000,
      zonesMonitored: 5,
      truncated: true,
    })
    expect(text).toContain('572 especies')
    expect(text).toContain('al menos 1,000')
    expect(text).toContain('no representa un inventario completo')
  })
})
