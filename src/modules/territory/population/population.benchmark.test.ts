import { existsSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { processedLaeaCog } from '@/modules/territory/population/processing/paths'
import { createPopulationService } from '@/modules/territory/population/population.service'

const COGS_READY = existsSync(processedLaeaCog('constrained'))

/**
 * Benchmark opcional — ejecutar en serie:
 * npx vitest run src/modules/territory/population/population.benchmark.test.ts --maxWorkers=1
 */
describe.skipIf(!COGS_READY)('population benchmark', () => {
  it('samplePoint median under 250ms after warm-up (serial)', async () => {
    const service = createPopulationService()
    const point = { latitude: 14.6349, longitude: -90.5069 }

    for (let i = 0; i < 5; i++) {
      await service.samplePoint(point)
    }

    const samples: number[] = []
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now()
      await service.samplePoint(point)
      samples.push(performance.now() - t0)
    }

    samples.sort((a, b) => a - b)
    const median = samples[Math.floor(samples.length / 2)] ?? 999
    expect(median).toBeLessThan(250)
  })
}, 60_000)
