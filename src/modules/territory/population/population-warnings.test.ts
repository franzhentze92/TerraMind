import { describe, expect, it } from 'vitest'

import {
  collectAdministrativeWarnings,
  collectPopulationZoneWarnings,
  POPULATION_WARNING_CODES,
} from '@/modules/territory/population/population-warnings'

describe('population warnings', () => {
  it('includes all required warning codes', () => {
    expect(POPULATION_WARNING_CODES).toContain('source_unavailable')
    expect(POPULATION_WARNING_CODES).toContain('adjustment_not_applied')
    expect(POPULATION_WARNING_CODES).toContain('geometry_outside_coverage')
    expect(POPULATION_WARNING_CODES).toHaveLength(10)
  })

  it('flags outdated reference year', () => {
    const warnings = collectPopulationZoneWarnings({
      dataCoveragePct: 100,
      nodataPixelCount: 0,
      referenceYear: 2010,
      currentYear: 2026,
    })
    expect(warnings.some((w) => w.code === 'outdated_reference_year')).toBe(true)
  })

  it('flags official mismatch above threshold', () => {
    const warnings = collectAdministrativeWarnings({
      municipalityCode: '0901',
      officialPopulation: 10_000,
      rasterSum: 13_000,
      mismatchThresholdPct: 15,
    })
    expect(warnings.some((w) => w.code === 'official_total_mismatch')).toBe(true)
  })
})
