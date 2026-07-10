import { describe, expect, it } from 'vitest'

import { populationDiffPct } from '@/modules/territory/population/processing/raster-stats'
import {
  WORLDPOP_CONSTRAINED_2020,
  WORLDPOP_PRODUCTS_2020,
  WORLDPOP_UNCONSTRAINED_2020,
} from '@/modules/territory/population/providers/worldpop/worldpop-products'
import {
  INE_DEPARTMENT_PROJECTIONS_2020,
  INE_NATIONAL_PROJECTION_2020,
} from '@/modules/territory/population/providers/ine/ine-projection-2020-reference'

describe('worldpop products manifest', () => {
  it('defines constrained and unconstrained 2020 with official URLs', () => {
    expect(WORLDPOP_PRODUCTS_2020).toHaveLength(2)
    expect(WORLDPOP_CONSTRAINED_2020.officialUrl).toContain('data.worldpop.org')
    expect(WORLDPOP_UNCONSTRAINED_2020.officialUrl).toContain('data.worldpop.org')
    expect(WORLDPOP_CONSTRAINED_2020.unit).toBe('persons_per_pixel')
    expect(WORLDPOP_UNCONSTRAINED_2020.referenceYear).toBe(2020)
  })
})

describe('populationDiffPct', () => {
  it('computes percent difference', () => {
    expect(populationDiffPct(100, 110)).toBe(10)
  })
})

describe('INE projection 2020 reference', () => {
  it('has 22 departments', () => {
    expect(INE_DEPARTMENT_PROJECTIONS_2020).toHaveLength(22)
  })

  it('lists 22 departments with pcode', () => {
    expect(INE_DEPARTMENT_PROJECTIONS_2020).toHaveLength(22)
    expect(INE_DEPARTMENT_PROJECTIONS_2020[0]?.adm1Pcode).toMatch(/^GT\d{2}$/)
  })
})
