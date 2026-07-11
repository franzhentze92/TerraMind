import { existsSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { processedLaeaCog } from '@/modules/territory/population/processing/paths'
import { createPopulationService } from '@/modules/territory/population/population.service'

const COGS_READY = existsSync(processedLaeaCog('constrained'))

const populationSuite = COGS_READY ? describe.sequential : describe.skip

populationSuite('population integration', () => {
  it('samplePoint returns stable values after warm-up', async () => {
    const service = createPopulationService()
    const point = { latitude: 14.6349, longitude: -90.5069 }

    for (let i = 0; i < 3; i++) {
      await service.samplePoint(point)
    }

    const first = await service.samplePoint(point)
    const second = await service.samplePoint(point)
    expect(first.estimatedPopulation).toBe(second.estimatedPopulation)
    expect(first.estimatedPopulation).toBeGreaterThan(0)
  })

  it('analyzeBuffers 4 radii returns constrained and validation', async () => {
    const service = createPopulationService()
    const result = await service.analyzeBuffers({
      points: [{ lat: 14.6349, lon: -90.5069 }],
      radiiMeters: [500, 1000, 3000, 5000],
      includeValidation: true,
    })
    expect(result.buffers).toHaveLength(4)
    expect(result.buffers[0]?.validationEstimate).toBeDefined()
    expect(result.buffers[0]?.estimatedPopulation).toBeGreaterThan(0)
  })
}, 60_000)
