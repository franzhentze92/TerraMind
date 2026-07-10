import { describe, expect, it } from 'vitest'

import {
  interpretVariantDifference,
  buildPopulationComparison,
} from '@/modules/territory/population/raster/population-variant-compare'

describe('population variant compare', () => {
  it('interprets small differences', () => {
    expect(interpretVariantDifference(3)).toContain('similares')
  })

  it('interprets moderate differences', () => {
    expect(interpretVariantDifference(12)).toContain('moderadamente')
  })

  it('interprets large differences', () => {
    expect(interpretVariantDifference(25)).toContain('significativa')
  })

  it('builds comparison object', () => {
    const c = buildPopulationComparison(1000, 1200)
    expect(c.absoluteDifference).toBe(200)
    expect(c.percentageDifference).toBe(20)
    expect(c.interpretation).toBeTruthy()
  })
})
