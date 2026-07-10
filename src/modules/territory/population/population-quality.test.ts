import { describe, expect, it } from 'vitest'

import { computeMunicipalAdjustmentFactor } from '@/modules/territory/population/admin/population-admin.service'
import { buildPopulationDataQuality } from '@/modules/territory/population/population-quality'
import {
  computeDataCoveragePct,
  computeDensityPerKm2,
} from '@/modules/territory/population/raster/population-zonal-statistics'

describe('population quality', () => {
  it('marks modelled source as pending reconciliation', () => {
    const q = buildPopulationDataQuality({
      source: 'worldpop',
      referenceYear: 2020,
      officialOrModelled: 'modelled_spatial_population',
      spatialResolutionM: 100,
      dataCoveragePct: 98,
    })
    expect(q.administrativeReconciliationStatus).toBe('pending')
    expect(q.warnings).toContain('adjustment_not_applied')
  })
})

describe('zonal statistics helpers', () => {
  it('computes density per km2', () => {
    expect(computeDensityPerKm2(1000, 100)).toBe(1000)
  })

  it('computes coverage pct', () => {
    expect(computeDataCoveragePct(95, 5)).toBe(95)
  })
})

describe('municipal adjustment factor', () => {
  it('returns null when reference years differ', () => {
    expect(computeMunicipalAdjustmentFactor(10_000, 8_000, 2018, 2020)).toBeNull()
  })

  it('computes factor when years match', () => {
    expect(computeMunicipalAdjustmentFactor(10_000, 8_000, 2020, 2020)).toBe(1.25)
  })
})
