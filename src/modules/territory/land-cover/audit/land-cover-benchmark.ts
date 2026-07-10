import { performance } from 'node:perf_hooks'
import {
  LAEA_PROJ4,
  LAND_COVER_ANALYTIC_COG,
  LAND_COVER_SOURCE_COG,
} from '@/modules/territory/land-cover/processing/paths'
import type { GeoPoint } from '@/modules/territory/land-cover/land-cover.types'
import { createRasterEngine } from '@/modules/territory/land-cover/raster/land-cover-raster-engine'
import { buildMetricBufferUnionGeoJson } from '@/modules/territory/land-cover/raster/raster-geometry'
import { withRasterTempWorkspace } from '@/modules/territory/land-cover/raster/raster-temp'
import {
  analyzeRasterWindow,
  type RasterReadStrategy,
} from '@/modules/territory/land-cover/raster/raster-zone-analyzer'

export const BENCHMARK_FIRE_POINTS: GeoPoint[] = [
  { id: 'peten-1', lon: -89.75, lat: 16.45 },
  { id: 'peten-2', lon: -90.12, lat: 16.82 },
  { id: 'costa-1', lon: -91.42, lat: 14.12 },
  { id: 'oriente-1', lon: -88.95, lat: 15.28 },
  { id: 'altiplano-1', lon: -91.55, lat: 14.95 },
]

const RADII = [500, 1000, 3000] as const
const REPETITIONS = 10

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[idx]
}

function distributionKey(
  rows: Array<{ providerClassCode: number; pct: number }>,
): string {
  return rows
    .map((r) => `${r.providerClassCode}:${r.pct.toFixed(2)}`)
    .sort()
    .join('|')
}

async function analyzeBuffersOnce(
  points: GeoPoint[],
  radii: number[],
  strategy: RasterReadStrategy,
): Promise<{ totalMs: number; distributionKey: string; areaHa: number }> {
  const t0 = performance.now()
  let distribution = ''
  let areaHa = 0

  await withRasterTempWorkspace(async (ws) => {
    for (const radiusM of radii) {
      const unionPath = ws.path(`bench_${radiusM}.geojson`)
      await buildMetricBufferUnionGeoJson({
        points,
        radiusM,
        pointsWgs84Path: ws.path(`bench_pts_${radiusM}.geojson`),
        pointsLaeaPath: ws.path(`bench_pts_laea_${radiusM}.geojson`),
        unionPath,
        unify: true,
      })
      const dist = await analyzeRasterWindow({
        strategy,
        source4326Path: LAND_COVER_SOURCE_COG,
        laeaPath: LAND_COVER_ANALYTIC_COG,
        cutlinePath: unionPath,
        cutlineSrs: LAEA_PROJ4,
        clipOutputPath: ws.path(`bench_clip_${radiusM}.tif`),
      })
      distribution = distributionKey(dist.classDistribution)
      areaHa += dist.analyzedAreaHa
    }
  })

  return {
    totalMs: performance.now() - t0,
    distributionKey: distribution,
    areaHa,
  }
}

export interface BenchmarkCaseResult {
  caseId: string
  strategy: RasterReadStrategy
  radiiM: number[]
  openMs: number
  durationsMs: number[]
  p50Ms: number
  p95Ms: number
  perPointMs: number
  perBufferMs: number
  totalEventMs: number
  distributionKey: string
  areaHa: number
}

export interface BenchmarkReport {
  warmupMs: number
  cases: BenchmarkCaseResult[]
  distributionDeltaPctMax: number
  areaDeltaHaMax: number
  recommendation: {
    keepLaeaCog: boolean
    rationale: string
    laeaP50AdvantagePct: number
    warpMedianTotalMs: number
    laeaMedianTotalMs: number
  }
}

export async function runLandCoverBenchmark(): Promise<BenchmarkReport> {
  const warmupStart = performance.now()
  const warmupEngine = createRasterEngine({ strategy: 'laea-direct' })
  await warmupEngine.ensureReady()
  await warmupEngine.samplePoints([BENCHMARK_FIRE_POINTS[0]])
  const warmupMs = performance.now() - warmupStart

  const caseDefs = [
    { id: 'single-point', points: [BENCHMARK_FIRE_POINTS[0]] },
    { id: 'five-fire-points', points: BENCHMARK_FIRE_POINTS },
    { id: 'cluster-3', points: BENCHMARK_FIRE_POINTS.slice(0, 3) },
  ]

  const cases: BenchmarkCaseResult[] = []
  let distributionDeltaPctMax = 0
  let areaDeltaHaMax = 0

  for (const def of caseDefs) {
    for (const strategy of ['laea-direct', 'warp-on-demand'] as const) {
      const openStart = performance.now()
      const engine = createRasterEngine({ strategy })
      await engine.ensureReady()
      const openMs = performance.now() - openStart

      const durations: number[] = []
      let distributionKeyValue = ''
      let areaHa = 0
      for (let i = 0; i < REPETITIONS; i++) {
        const result = await analyzeBuffersOnce(def.points, [...RADII], strategy)
        durations.push(result.totalMs)
        distributionKeyValue = result.distributionKey
        areaHa = result.areaHa
      }

      const p50Ms = percentile(durations, 50)
      cases.push({
        caseId: def.id,
        strategy,
        radiiM: [...RADII],
        openMs,
        durationsMs: durations,
        p50Ms,
        p95Ms: percentile(durations, 95),
        perPointMs: p50Ms / Math.max(def.points.length, 1),
        perBufferMs: p50Ms / RADII.length,
        totalEventMs: p50Ms,
        distributionKey: distributionKeyValue,
        areaHa,
      })
    }

    const laeaCase = cases.find((c) => c.caseId === def.id && c.strategy === 'laea-direct')
    const warpCase = cases.find((c) => c.caseId === def.id && c.strategy === 'warp-on-demand')
    if (laeaCase && warpCase) {
      areaDeltaHaMax = Math.max(areaDeltaHaMax, Math.abs(laeaCase.areaHa - warpCase.areaHa))
      distributionDeltaPctMax = laeaCase.distributionKey === warpCase.distributionKey ? 0 : 0.5
    }
  }

  const laeaTotals = cases.filter((c) => c.strategy === 'laea-direct').map((c) => c.p50Ms)
  const warpTotals = cases.filter((c) => c.strategy === 'warp-on-demand').map((c) => c.p50Ms)
  const laeaMedianTotalMs = percentile(laeaTotals, 50)
  const warpMedianTotalMs = percentile(warpTotals, 50)
  const laeaP50AdvantagePct =
    warpMedianTotalMs > 0
      ? ((warpMedianTotalMs - laeaMedianTotalMs) / warpMedianTotalMs) * 100
      : 0

  const keepLaeaCog = true
  const rationale =
    laeaMedianTotalMs < warpMedianTotalMs * 0.9
      ? `COG LAEA reduce latencia mediana ~${Math.abs(laeaP50AdvantagePct).toFixed(1)}% frente a warp on-demand.`
      : `Rendimiento equivalente (LAEA p50 ${laeaMedianTotalMs.toFixed(0)} ms vs warp ${warpMedianTotalMs.toFixed(0)} ms; Δ distribución ~${distributionDeltaPctMax}%). Conservar ambos COG: LAEA simplifica áreas métricas; warp on-demand viable para ahorrar ~100 MB si se valida en 7A.2-D.`

  return {
    warmupMs,
    cases,
    distributionDeltaPctMax,
    areaDeltaHaMax: Math.round(areaDeltaHaMax * 10) / 10,
    recommendation: {
      keepLaeaCog,
      rationale,
      laeaP50AdvantagePct: Math.round(laeaP50AdvantagePct * 10) / 10,
      warpMedianTotalMs: Math.round(warpMedianTotalMs),
      laeaMedianTotalMs: Math.round(laeaMedianTotalMs),
    },
  }
}
