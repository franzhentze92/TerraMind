import { describe, expect, it } from 'vitest'

import { DIAGNOSTIC_MAP_ZONES } from '@/modules/territory/population/processing/diagnostic-maps'
import { POPULATION_SUM_TOLERANCE_PCT } from '@/modules/territory/population/processing/paths'

describe('population processing constants', () => {
  it('defines conservation tolerance thresholds', () => {
    expect(POPULATION_SUM_TOLERANCE_PCT.constrained).toBe(0.5)
    expect(POPULATION_SUM_TOLERANCE_PCT.unconstrained).toBe(1.5)
  })

  it('defines four diagnostic map zones', () => {
    expect(DIAGNOSTIC_MAP_ZONES).toHaveLength(4)
    expect(DIAGNOSTIC_MAP_ZONES.map((z) => z.slug)).toContain('guatemala-city')
  })
})
