#!/usr/bin/env npx tsx
/**
 * CHIRPS v3 pentad ingest — scheduler-friendly + isolated diagnostic CLI.
 *
 * Modes:
 *   Health (default):
 *     npx tsx scripts/chirps-v3-ingest.ts [--variant=final|preliminary] [--dry-run]
 *
 *   Download a single known pentad only (no processing):
 *     npx tsx scripts/chirps-v3-ingest.ts --variant=final --year=2020 --month=5 --pentad=3 --download-only
 *
 *   Process a local file only (GDAL clip + normalize), dry-run (no productive persistence):
 *     npx tsx scripts/chirps-v3-ingest.ts --local-file=<path> --year=2020 --month=5 --pentad=3 --process-only --dry-run
 *
 *   Full isolated end-to-end for one pentad (download -> clip -> observations -> pipeline dry-run):
 *     npx tsx scripts/chirps-v3-ingest.ts --variant=final --year=2020 --month=5 --pentad=3 --e2e
 */
import { toPentadRef } from '@/modules/precipitation/chirps-v3/chirps-pentad.calendar'
import { dateToPentad } from '@/modules/precipitation/chirps-v3/chirps-pentad.calendar'
import { downloadChirpsPentadTif } from '@/modules/precipitation/chirps-v3/chirps-v3.download'
import { readChirpsGridFromTif, isGdalAvailable } from '@/modules/precipitation/chirps-v3/chirps-v3.raster'
import { chirpsPentadTifUrl, type ChirpsVariant } from '@/modules/precipitation/chirps-v3/chirps-v3.urls'
import { normalizeGridToObservations } from '@/modules/precipitation/chirps-v3/chirps-v3.observations'
import { runDetectionPipeline } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.pipeline'
import { chirpsV3FinalAdapter, chirpsV3PreliminaryAdapter } from '../server/services/environmental-events/chirps-v3-source.adapter.js'
import { rainfallDeficitDetector } from '@/events/rainfall-deficit/event.detector'

interface Args {
  variant: ChirpsVariant
  year?: number
  month?: number
  pentad?: number
  localFile?: string
  dryRun: boolean
  downloadOnly: boolean
  processOnly: boolean
  e2e: boolean
}

function parseArgs(): Args {
  const raw = process.argv.slice(2)
  const get = (name: string) => raw.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
  const has = (name: string) => raw.includes(`--${name}`)
  const variant = (get('variant') as ChirpsVariant) ?? 'final'
  return {
    variant: variant === 'preliminary' ? 'preliminary' : 'final',
    year: get('year') ? Number(get('year')) : undefined,
    month: get('month') ? Number(get('month')) : undefined,
    pentad: get('pentad') ? Number(get('pentad')) : undefined,
    localFile: get('local-file'),
    dryRun: has('dry-run'),
    downloadOnly: has('download-only'),
    processOnly: has('process-only'),
    e2e: has('e2e'),
  }
}

async function stage<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t = Date.now()
  process.stdout.write(`  [${label}] inicio\n`)
  try {
    const result = await fn()
    process.stdout.write(`  [${label}] fin — ${Date.now() - t} ms\n`)
    return result
  } catch (err) {
    process.stdout.write(`  [${label}] ERROR — ${Date.now() - t} ms — ${err instanceof Error ? err.message : String(err)}\n`)
    throw err
  }
}

function memMb(): string {
  return `${Math.round(process.memoryUsage().rss / 1_048_576)} MB rss`
}

async function main() {
  const args = parseArgs()

  // --- Health mode (default, no target pentad) ---
  if (!args.downloadOnly && !args.processOnly && !args.e2e && !args.localFile && args.year === undefined) {
    const adapter = args.variant === 'preliminary' ? chirpsV3PreliminaryAdapter : chirpsV3FinalAdapter
    const health = await adapter.getHealth()
    console.log(`[chirps-v3-ingest] ${adapter.label} — healthy=${health.healthy} — ${health.detail ?? ''}`)
    if (args.dryRun) {
      console.log('[chirps-v3-ingest] dry-run; no fetch.')
      return
    }
    const now = dateToPentad(new Date())
    const raw = await adapter.fetch({ until: now.periodEnd })
    console.log(`[chirps-v3-ingest] fetched ${raw.length} pentad file(s)`)
    const observations = await adapter.normalize(raw, { now: new Date() })
    console.log(`[chirps-v3-ingest] normalized ${observations.length} cell observation(s)`)
    if (observations.length > 0) {
      const results = await rainfallDeficitDetector.detect(observations, { now: new Date() })
      console.log(`[chirps-v3-ingest] detection produced ${results.length} event update(s)`)
    }
    return
  }

  if (args.year === undefined || args.month === undefined || args.pentad === undefined) {
    console.error('[chirps-v3-ingest] --year --month --pentad son obligatorios en modos aislados.')
    process.exit(2)
  }
  const ref = toPentadRef(args.year, args.month, args.pentad)
  const url = chirpsPentadTifUrl(ref, args.variant)
  console.log(`[chirps-v3-ingest] pentad ${args.year}-${args.month}-${args.pentad} variant=${args.variant}`)
  console.log(`[chirps-v3-ingest] url=${url}`)

  let localPath = args.localFile
  let sha256 = ''

  // --- Download stage ---
  if (!args.processOnly) {
    const dl = await stage('download', () => downloadChirpsPentadTif(ref, args.variant, { force: false }))
    localPath = dl.path
    sha256 = dl.sha256
    console.log(`  → skipped=${dl.skipped} sizeBytes=${dl.sizeBytes} sha256=${dl.sha256.slice(0, 12)}… path=${dl.path}`)
    if (args.downloadOnly) {
      console.log(`[chirps-v3-ingest] download-only completado. ${memMb()}`)
      return
    }
  }

  if (!localPath) {
    console.error('[chirps-v3-ingest] --local-file requerido en --process-only.')
    process.exit(2)
  }

  // --- GDAL availability ---
  const gdalOk = await stage('gdal-check', async () => isGdalAvailable())
  if (!gdalOk) {
    console.error('[chirps-v3-ingest] GDAL no disponible; no se puede procesar.')
    process.exit(3)
  }

  // --- Clip Guatemala + read raster ---
  const grid = await stage('clip+read', () =>
    readChirpsGridFromTif(localPath!, {
      variant: args.variant,
      pentadKey: `${ref.year}-${ref.month}-${ref.pentad}`,
      sourceUrl: url,
      checksum: sha256 || undefined,
    }),
  )
  const valid = grid.cells.filter((c) => !c.isNoData)
  const nodata = grid.cells.length - valid.length
  const mmValues = valid.map((c) => c.precipitationMm)
  const minMm = mmValues.length ? Math.min(...mmValues) : NaN
  const maxMm = mmValues.length ? Math.max(...mmValues) : NaN
  console.log(
    `  → grid ${grid.cols}x${grid.rows}=${grid.cells.length} celdas | válidas=${valid.length} nodata=${nodata} | mm[min=${minMm.toFixed(2)} max=${maxMm.toFixed(2)}]`,
  )

  // --- Normalize observations ---
  const observations = await stage('normalize', async () =>
    normalizeGridToObservations(grid, ref, args.variant),
  )
  const anyNaN = observations.some((o) => !Number.isFinite(o.attributes.precipitationMm))
  const uniqueIds = new Set(observations.map((o) => o.id)).size
  console.log(
    `  → observaciones=${observations.length} | ids únicos=${uniqueIds} | NaN=${anyNaN} | checksum=${observations[0]?.attributes.checksum?.slice(0, 12) ?? '—'}`,
  )

  // --- Pipeline dry-run (no productive persistence) ---
  const pipe = await stage('pipeline-dry-run', async () =>
    runDetectionPipeline({
      observations,
      existingEvents: [],
      cellConsecutive: {},
      endDate: new Date(ref.periodEnd),
    }),
  )
  console.log(`  → pipeline eventos=${pipe.events.length} (esperado 0 para un solo pentad sin baseline)`)

  console.log(`[chirps-v3-ingest] end-to-end OK. ${memMb()}`)
}

main().catch((err) => {
  const code = (err as { code?: string }).code
  console.error(`[chirps-v3-ingest] failed${code ? ` (${code})` : ''}:`, err instanceof Error ? err.message : err)
  process.exit(1)
})
