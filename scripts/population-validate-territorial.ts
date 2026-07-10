#!/usr/bin/env tsx
import { performance } from 'node:perf_hooks'

import { createPopulationService } from '@/modules/territory/population/population.service'
import { buildPopulationComparison } from '@/modules/territory/population/raster/population-variant-compare'

const ZONES = [
  { name: 'Ciudad de Guatemala', lat: 14.6349, lon: -90.5069 },
  { name: 'Mixco', lat: 14.6333, lon: -90.6064 },
  { name: 'Villa Nueva', lat: 14.525, lon: -90.588 },
  { name: 'Champerico', lat: 14.2883, lon: -91.9081 },
  { name: 'Lago de Atitlán (centro)', lat: 14.6833, lon: -91.2 },
  { name: 'Sierra de las Minas', lat: 15.1, lon: -89.85 },
  { name: 'Reserva Biosfera Maya', lat: 17.75, lon: -89.5 },
  { name: 'Corredor Seco', lat: 14.75, lon: -89.35 },
  { name: 'Comunidad rural dispersa (Huehuetenango)', lat: 15.3147, lon: -91.4761 },
  { name: 'Zona no habitada (volcán Tajumulco)', lat: 15.043, lon: -91.903 },
] as const

const RADII = [500, 1000, 3000, 5000]

async function main() {
  const service = createPopulationService()
  const status = await service.getSourceStatus()
  if (!status.isReady) {
    throw new Error('PopulationService no listo — ejecutar prepare-worldpop.')
  }

  const rows: Array<Record<string, unknown>> = []

  for (const zone of ZONES) {
    const t0 = performance.now()
    const result = await service.analyzeBuffers({
      points: [{ lat: zone.lat, lon: zone.lon }],
      radiiMeters: RADII,
      includeValidation: true,
    })
    const elapsedMs = Math.round(performance.now() - t0)

    for (const buffer of result.buffers) {
      const comparison =
        buffer.validationEstimate != null
          ? buildPopulationComparison(buffer.estimatedPopulation, buffer.validationEstimate)
          : null
      rows.push({
        zone: zone.name,
        radiusM: buffer.radiusM,
        constrained: buffer.estimatedPopulation,
        unconstrained: buffer.validationEstimate,
        differencePct: comparison?.percentageDifference,
        coveragePct: buffer.dataCoveragePct,
        warnings: (buffer.warnings ?? result.warnings).map((w) => w.code),
        elapsedMsTotal: elapsedMs,
      })
    }
  }

  console.log(JSON.stringify({ zones: rows.length / RADII.length, rows }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
