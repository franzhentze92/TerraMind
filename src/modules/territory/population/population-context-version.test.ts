import { describe, expect, it } from 'vitest'

import {
  buildPopulationContextVersion,
  POPULATION_DEFAULT_BUFFER_RADII_M,
} from '@/modules/territory/population/population-context-version'

describe('buildPopulationContextVersion', () => {
  it('is deterministic for the same inputs', () => {
    const input = {
      sourceCode: 'worldpop',
      sourceVersion: 'R2025A-v1',
      productType: 'constrained' as const,
      rasterHash: 'abc123',
      referenceYear: 2020,
      analysisMethodVersion: 'zonal-sum-window-v1',
      crs: 'LAEA-GT',
      resamplingMethod: 'sum',
      zoneRadiiM: [500, 1000, 3000, 5000],
    }
    const a = buildPopulationContextVersion(input)
    const b = buildPopulationContextVersion(input)
    expect(a).toBe(b)
    expect(a).toHaveLength(16)
  })

  it('changes when radii order differs but sorts internally', () => {
    const base = {
      sourceCode: 'worldpop',
      sourceVersion: 'R2025A-v1',
      productType: 'constrained' as const,
      rasterHash: 'abc123',
      referenceYear: 2020,
      analysisMethodVersion: 'zonal-sum-window-v1',
      crs: 'LAEA-GT',
      resamplingMethod: 'sum',
    }
    const ordered = buildPopulationContextVersion({
      ...base,
      zoneRadiiM: [500, 1000, 3000],
    })
    const reversed = buildPopulationContextVersion({
      ...base,
      zoneRadiiM: [3000, 1000, 500],
    })
    expect(ordered).toBe(reversed)
  })

  it('uses default buffer radii constant', () => {
    expect(POPULATION_DEFAULT_BUFFER_RADII_M).toEqual([500, 1000, 3000, 5000])
    expect(POPULATION_DEFAULT_BUFFER_RADII_M).not.toContain(10_000)
  })
})
