import { describe, expect, it } from 'vitest'

import {
  buildAdminRasterComparison,
  interpretAdminRasterDifference,
} from '@/modules/territory/population/admin/population-admin-compare'

describe('population-admin-compare', () => {
  it('interprets difference bands', () => {
    expect(interpretAdminRasterDifference(3)).toContain('concordancia')
    expect(interpretAdminRasterDifference(10)).toContain('moderada')
    expect(interpretAdminRasterDifference(20)).toContain('significativa')
  })

  it('marks temporal mismatch when official year != raster year', () => {
    const comparison = buildAdminRasterComparison({
      adminLevel: 'department',
      adminCode: '13',
      adminName: 'Huehuetenango',
      officialPopulation: 1_000_000,
      officialReferenceYear: 2018,
      statisticType: 'census',
      temporalAlignment: 'exact',
      rasterConstrainedSum: 1_050_000,
    })
    expect(comparison.temporalAlignment).toBe('mismatch')
  })
})
