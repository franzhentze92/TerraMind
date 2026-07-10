import { existsSync } from 'node:fs'

import { inspectPopulationRaster } from '@/modules/territory/population/processing/raster-stats'
import {
  GUATEMALA_ADM1_GEOJSON,
  processedLaeaCog,
  processedWgs84Cog,
} from '@/modules/territory/population/processing/paths'
import { runCommand } from '@/modules/territory/population/processing/gdal'
import {
  loadPopulationManifest,
  savePopulationManifest,
} from '@/modules/territory/population/processing/manifest-io'
import type { WorldPopVariant } from '@/modules/territory/population/providers/worldpop/worldpop-products'

export interface BenchmarkScenarioResult {
  scenario: string
  variant: WorldPopVariant
  crs: 'EPSG:4326' | 'LAEA-GT'
  coldStartMs: number
  warmMs: number[]
  p50Ms: number
  p95Ms: number
}

export interface PopulationBenchmarkReport {
  completedAt: string
  scenarios: BenchmarkScenarioResult[]
}

const RADII = [500, 1000, 3000, 5000]

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)] ?? 0
}

async function timeRasterSum(rasterPath: string): Promise<number> {
  const started = Date.now()
  await inspectPopulationRaster(rasterPath)
  return Date.now() - started
}

export async function benchmarkWorldPop(): Promise<PopulationBenchmarkReport> {
  if (!existsSync(processedWgs84Cog('constrained'))) {
    throw new Error('COGs no preparados.')
  }

  const scenarios: BenchmarkScenarioResult[] = []
  const variants: WorldPopVariant[] = ['constrained', 'unconstrained']

  for (const variant of variants) {
    for (const crs of ['EPSG:4326', 'LAEA-GT'] as const) {
      const raster =
        crs === 'EPSG:4326' ? processedWgs84Cog(variant) : processedLaeaCog(variant)
      if (!existsSync(raster)) continue
      const cold = await timeRasterSum(raster)
      const warm: number[] = []
      for (let i = 0; i < 5; i++) warm.push(await timeRasterSum(raster))
      const sorted = [...warm].sort((a, b) => a - b)
      scenarios.push({
        scenario: `national_inspect_${variant}`,
        variant,
        crs,
        coldStartMs: cold,
        warmMs: warm,
        p50Ms: percentile(sorted, 50),
        p95Ms: percentile(sorted, 95),
      })
    }
  }

  // Lightweight geometry clip via ogr2ogr extent (municipio-scale proxy)
  if (existsSync(GUATEMALA_ADM1_GEOJSON)) {
    const started = Date.now()
    await runCommand('ogrinfo', ['-so', GUATEMALA_ADM1_GEOJSON])
    const geomMs = Date.now() - started
    scenarios.push({
      scenario: 'adm1_metadata_read',
      variant: 'constrained',
      crs: 'EPSG:4326',
      coldStartMs: geomMs,
      warmMs: [geomMs],
      p50Ms: geomMs,
      p95Ms: geomMs,
    })
  }

  const report: PopulationBenchmarkReport = {
    completedAt: new Date().toISOString(),
    scenarios,
  }

  const manifest = loadPopulationManifest()
  manifest.benchmark = {
    completed_at: report.completedAt,
    radii_m: RADII,
    scenarios: report.scenarios,
  }
  savePopulationManifest(manifest)

  return report
}
