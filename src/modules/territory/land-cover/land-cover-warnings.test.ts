import { describe, expect, it } from 'vitest'
import {
  collectPointWarnings,
  collectZoneWarnings,
} from '@/modules/territory/land-cover/land-cover-warnings'

describe('land-cover warnings', () => {
  it('flags outdated source year', () => {
    const warnings = collectPointWarnings({
      nodataCount: 0,
      outsideCount: 0,
      dominantClasses: new Set(['forest']),
      referenceYear: 2021,
      currentYear: 2026,
    })
    expect(warnings.some((w) => w.code === 'outdated_source_year')).toBe(true)
  })

  it('flags mixed point classes', () => {
    const warnings = collectPointWarnings({
      nodataCount: 0,
      outsideCount: 0,
      dominantClasses: new Set(['forest', 'cropland']),
      referenceYear: 2021,
      currentYear: 2026,
    })
    expect(warnings.some((w) => w.code === 'mixed_point_classes')).toBe(true)
  })

  it('flags incomplete zone coverage', () => {
    const warnings = collectZoneWarnings({ dataCoveragePct: 80 })
    expect(warnings[0]?.code).toBe('incomplete_zone_coverage')
  })
})
