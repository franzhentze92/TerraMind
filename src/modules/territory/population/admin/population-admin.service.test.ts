import { describe, expect, it } from 'vitest'

import { createPopulationAdminService } from '@/modules/territory/population/admin/population-admin.service'

describe('PopulationAdminService', () => {
  const service = createPopulationAdminService()

  it('returns national projection 2020', async () => {
    const record = await service.getNationalPopulation({
      referenceYear: 2020,
      statisticType: 'projection',
    })
    expect(record?.populationTotal).toBeGreaterThan(17_000_000)
    expect(record?.isProjection).toBe(true)
  })

  it('returns Huehuetenango department', async () => {
    const record = await service.getDepartmentPopulation({
      departmentCode: '13',
      referenceYear: 2020,
      statisticType: 'projection',
    })
    expect(record?.adminName).toMatch(/Huehuetenango/i)
  })

  it('getAdministrativeContext uses projection 2020 for department', async () => {
    const ctx = await service.getAdministrativeContext({
      departmentCode: '13',
      referenceYear: 2020,
    })
    expect(ctx.status).toBe('available')
    expect(ctx.department?.referenceYear).toBe(2020)
    expect(ctx.semantics).toBe('official_administrative_population')
  })

  it('warns on municipality year mismatch vs 2020', async () => {
    const ctx = await service.getAdministrativeContext({
      municipalityCode: '0101',
      referenceYear: 2020,
    })
    expect(ctx.municipality?.referenceYear).toBe(2018)
    expect(ctx.warnings?.some((w) => w.code === 'official_year_mismatch')).toBe(true)
    expect(ctx.temporalAlignment).toBe('mismatch')
  })

  it('compareAdministrativeToRaster without raster sums', async () => {
    const comparison = await service.compareAdministrativeToRaster({
      adminLevel: 'department',
      adminCode: '13',
      referenceYear: 2020,
    })
    expect(comparison.officialReferenceYear).toBe(2020)
    expect(comparison.rasterConstrainedSum).toBeUndefined()
  })
})
