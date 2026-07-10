import { describe, expect, it } from 'vitest'

import {
  getOfficialAdministrativeSource,
  getPrimarySpatialSource,
  POPULATION_SOURCE_REGISTRY,
  RECOMMENDED_SPATIAL_SOURCE_CODE,
} from '@/modules/territory/population/population-source-registry'
import { createPopulationService } from '@/modules/territory/population/population.service'

describe('population source registry', () => {
  it('registers INE, WorldPop and GHSL', () => {
    expect(POPULATION_SOURCE_REGISTRY).toHaveLength(3)
    expect(getOfficialAdministrativeSource().sourceCode).toBe('ine_guatemala')
    expect(getPrimarySpatialSource().sourceCode).toBe('worldpop')
    expect(RECOMMENDED_SPATIAL_SOURCE_CODE).toBe('worldpop')
  })

  it('distinguishes official vs modelled semantics', () => {
    const official = getOfficialAdministrativeSource()
    const spatial = getPrimarySpatialSource()
    expect(official.semantics).toBe('official_administrative_population')
    expect(spatial.semantics).toBe('modelled_spatial_population')
    expect(official.isOfficial).toBe(true)
    expect(spatial.isOfficial).toBe(false)
  })
})

describe('createPopulationService (stub)', () => {
  it('returns source status from local datasets', async () => {
    const service = createPopulationService()
    const status = await service.getSourceStatus()
    expect(status.sourceCode).toBe('worldpop')
    expect(status.semantics).toBe('modelled_spatial_population')
    if (status.isReady) {
      expect(status.totalPopulation).toBeGreaterThan(0)
    }
  })

  it('analyzeBuffers returns design skeleton with default radii', async () => {
    const service = createPopulationService()
    const result = await service.analyzeBuffers({
      points: [{ lon: -90.5, lat: 14.63 }],
      radiiMeters: [500, 1000, 3000, 5000],
    })
    expect(result.buffers).toHaveLength(4)
    expect(result.semantics).toBe('modelled_spatial_population')
    expect(result.disclaimer).toContain('no implica afectación')
  })
})
