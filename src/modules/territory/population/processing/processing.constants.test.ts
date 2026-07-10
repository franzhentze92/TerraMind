import { describe, expect, it } from 'vitest'

import { CONSERVATION_PASS_MAX_PCT, CONSERVATION_WARNING_MAX_PCT } from '@/modules/territory/population/processing/population-conservation'
import { DIAGNOSTIC_MAP_ZONES } from '@/modules/territory/population/processing/diagnostic-maps'

describe('population processing constants', () => {
  it('defines conservation tolerance thresholds', () => {
    expect(CONSERVATION_PASS_MAX_PCT).toBe(0.1)
    expect(CONSERVATION_WARNING_MAX_PCT).toBe(0.5)
  })

  it('defines four diagnostic map zones', () => {
    expect(DIAGNOSTIC_MAP_ZONES).toHaveLength(4)
    expect(DIAGNOSTIC_MAP_ZONES.map((z) => z.slug)).toContain('guatemala-city')
  })
})
