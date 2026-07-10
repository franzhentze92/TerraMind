import 'dotenv/config'
import { runLandCoverBenchmark } from '@/modules/territory/land-cover/audit/land-cover-benchmark'

async function main(): Promise<void> {
  console.log('⏱️  Benchmark raster cobertura del suelo — Guatemala (7A.2-C)')
  const report = await runLandCoverBenchmark()
  console.log(
    JSON.stringify(
      {
        event: 'land_cover_benchmark_complete',
        warmup_ms: Math.round(report.warmupMs),
        distribution_delta_pct_max: report.distributionDeltaPctMax,
        area_delta_ha_max: report.areaDeltaHaMax,
        recommendation: report.recommendation,
        cases: report.cases.map((c) => ({
          case_id: c.caseId,
          strategy: c.strategy,
          radii_m: c.radiiM,
          open_ms: Math.round(c.openMs),
          p50_ms: Math.round(c.p50Ms),
          p95_ms: Math.round(c.p95Ms),
          per_point_ms: Math.round(c.perPointMs),
          per_buffer_ms: Math.round(c.perBufferMs),
          area_ha: Math.round(c.areaHa),
        })),
      },
      null,
      2,
    ),
  )
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ event: 'land_cover_benchmark_error', message }))
  process.exit(1)
})
