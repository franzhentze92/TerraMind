#!/usr/bin/env npx tsx
/**
 * CHIRPS v3 — historical climatology builder (1991–2020, Guatemala, resumable).
 *
 * Downloads CHIRPS v3 FINAL pentads, clips to Guatemala, stores a compact
 * Float32 pentad cache and DELETES the raw LATAM GeoTIFF to protect disk space.
 * Resumable via checkpoint; skips completed pentads.
 *
 * Examples:
 *   npx tsx scripts/chirps-v3-build-climatology.ts --start-year=1991 --end-year=2020 --country=GT
 *   npx tsx scripts/chirps-v3-build-climatology.ts --year=1991 --from-pentad=1 --to-pentad=72 --resume
 *   npx tsx scripts/chirps-v3-build-climatology.ts --verify-only
 *   npx tsx scripts/chirps-v3-build-climatology.ts --dry-run --start-year=1991 --end-year=1992
 */
import { existsSync, rmSync } from 'node:fs'
import { toPentadRef } from '@/modules/precipitation/chirps-v3/chirps-pentad.calendar'
import { CHIRPS_V3_PROCESSING_VERSION } from '@/modules/precipitation/chirps-v3/chirps-v3.config'
import { downloadChirpsPentadTif, probeChirpsUrl } from '@/modules/precipitation/chirps-v3/chirps-v3.download'
import { chirpsPentadTifUrl } from '@/modules/precipitation/chirps-v3/chirps-v3.urls'
import { readChirpsGridFromTif, isGdalAvailable } from '@/modules/precipitation/chirps-v3/chirps-v3.raster'
import {
  CLIMATOLOGY_ROOT,
  PENTADS_PER_YEAR,
  ingestKey,
  loadCheckpoint,
  loadGrid,
  pentadCachePath,
  saveCheckpoint,
  saveGrid,
  slotToMonthPentad,
  writePentadCache,
  type ClimatologyGrid,
  type IngestCheckpoint,
} from '@/modules/precipitation/chirps-v3/chirps-climatology.store'

interface Args {
  startYear: number
  endYear: number
  singleYear?: number
  fromPentad: number
  toPentad: number
  resume: boolean
  verifyOnly: boolean
  dryRun: boolean
  concurrency: number
}

function parseArgs(): Args {
  const raw = process.argv.slice(2)
  const get = (n: string) => raw.find((a) => a.startsWith(`--${n}=`))?.split('=')[1]
  const has = (n: string) => raw.includes(`--${n}`)
  const singleYear = get('year') ? Number(get('year')) : undefined
  return {
    startYear: Number(get('start-year') ?? singleYear ?? 1991),
    endYear: Number(get('end-year') ?? singleYear ?? 2020),
    singleYear,
    fromPentad: Number(get('from-pentad') ?? 1),
    toPentad: Number(get('to-pentad') ?? PENTADS_PER_YEAR),
    resume: has('resume'),
    verifyOnly: has('verify-only'),
    dryRun: has('dry-run'),
    concurrency: Math.max(1, Math.min(6, Number(get('concurrency') ?? 4))),
  }
}

interface Target {
  year: number
  slot: number
  month: number
  pentad: number
}

function buildTargets(args: Args): Target[] {
  const targets: Target[] = []
  for (let year = args.startYear; year <= args.endYear; year++) {
    for (let slot = args.fromPentad; slot <= args.toPentad; slot++) {
      const { month, pentad } = slotToMonthPentad(slot)
      targets.push({ year, slot, month, pentad })
    }
  }
  return targets
}

async function processOne(
  t: Target,
  gridRef: { grid: ClimatologyGrid | null },
): Promise<{ cellCount: number }> {
  const ref = toPentadRef(t.year, t.month, t.pentad)
  const dl = await downloadChirpsPentadTif(ref, 'final', { maxRetries: 4 })
  const grid = await readChirpsGridFromTif(dl.path, {
    variant: 'final',
    pentadKey: `${t.year}-${t.month}-${t.pentad}`,
    sourceUrl: dl.url,
    checksum: dl.sha256,
  })

  const values = new Float32Array(grid.cells.length)
  for (let i = 0; i < grid.cells.length; i++) {
    const c = grid.cells[i]!
    values[i] = c.isNoData ? Number.NaN : c.precipitationMm
  }
  writePentadCache(t.year, t.slot, values)

  // Persist grid index once (row-major cell descriptors).
  if (!gridRef.grid) {
    const gridDef: ClimatologyGrid = {
      rows: grid.rows,
      cols: grid.cols,
      cellCount: grid.cells.length,
      bbox: [
        Math.min(...grid.cells.map((c) => c.lon)),
        Math.min(...grid.cells.map((c) => c.lat)),
        Math.max(...grid.cells.map((c) => c.lon)),
        Math.max(...grid.cells.map((c) => c.lat)),
      ],
      resolutionDeg: grid.resolutionDeg,
      cells: grid.cells.map((c) => ({ row: c.row, col: c.col, lat: c.lat, lon: c.lon })),
    }
    saveGrid(gridDef)
    gridRef.grid = gridDef
  }

  // Delete raw LATAM GeoTIFF to protect disk (clip cache is enough).
  if (existsSync(dl.path)) rmSync(dl.path, { force: true })
  return { cellCount: grid.cells.length }
}

async function runPool(
  targets: Target[],
  concurrency: number,
  cp: IngestCheckpoint,
  gridRef: { grid: ClimatologyGrid | null },
): Promise<void> {
  const completed = new Set(cp.completed)
  const queue = targets.filter((t) => !completed.has(ingestKey(t.year, t.slot)))
  console.log(`[climatology] pendientes=${queue.length} / total=${targets.length} (concurrency=${concurrency})`)
  const started = Date.now()
  let done = 0
  let cursor = 0

  async function worker(id: number): Promise<void> {
    while (cursor < queue.length) {
      const t = queue[cursor++]!
      const key = ingestKey(t.year, t.slot)
      try {
        await processOne(t, gridRef)
        cp.completed.push(key)
        cp.failed = cp.failed.filter((f) => f.key !== key)
      } catch (err) {
        const code = (err as { code?: string }).code ?? 'PROCESS_FAILED'
        cp.failed = cp.failed.filter((f) => f.key !== key)
        cp.failed.push({ key, code, message: err instanceof Error ? err.message : String(err) })
        console.warn(`[climatology] fallo ${key}: ${code}`)
      }
      done++
      if (done % 20 === 0 || cursor >= queue.length) {
        saveCheckpoint(cp)
        const elapsed = (Date.now() - started) / 1000
        const rate = done / elapsed
        const eta = rate > 0 ? Math.round((queue.length - done) / rate) : 0
        console.log(`[climatology] ${done}/${queue.length} | ${rate.toFixed(2)}/s | ETA ~${eta}s | worker${id}`)
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i + 1)))
  saveCheckpoint(cp)
}

function verify(args: Args, cp: IngestCheckpoint): void {
  const grid = loadGrid()
  const targets = buildTargets(args)
  let present = 0
  const missing: string[] = []
  for (const t of targets) {
    if (existsSync(pentadCachePath(t.year, t.slot))) present++
    else missing.push(ingestKey(t.year, t.slot))
  }
  console.log(`[climatology] verify: presentes=${present}/${targets.length} | faltantes=${missing.length}`)
  console.log(`[climatology] grid=${grid ? `${grid.cols}x${grid.rows}=${grid.cellCount}` : 'no construido'}`)
  console.log(`[climatology] checkpoint completados=${cp.completed.length} fallidos=${cp.failed.length}`)
  if (missing.length > 0 && missing.length <= 40) console.log(`[climatology] faltantes: ${missing.join(', ')}`)
}

async function main() {
  const args = parseArgs()
  const cp = loadCheckpoint(CHIRPS_V3_PROCESSING_VERSION)
  console.log(`[climatology] root=${CLIMATOLOGY_ROOT}`)
  console.log(`[climatology] rango años=${args.startYear}-${args.endYear} pentadas=${args.fromPentad}-${args.toPentad}`)

  if (args.verifyOnly) {
    verify(args, cp)
    return
  }

  const gdalOk = await isGdalAvailable()
  if (!gdalOk) {
    console.error('[climatology] GDAL no disponible; abortando.')
    process.exit(3)
  }

  const targets = buildTargets(args)
  if (args.dryRun) {
    // Probe a small sample without downloading full files.
    const sample = targets.slice(0, 3)
    for (const t of sample) {
      const ref = toPentadRef(t.year, t.month, t.pentad)
      const probe = await probeChirpsUrl(chirpsPentadTifUrl(ref, 'final'))
      console.log(`[climatology] dry-run probe ${t.year}-${t.slot}: ok=${probe.ok} bytes=${probe.contentLength ?? '—'}`)
    }
    console.log(`[climatology] dry-run: ${targets.length} pentadas objetivo. Sin descargas.`)
    return
  }

  const gridRef = { grid: loadGrid() }
  await runPool(targets, args.concurrency, cp, gridRef)
  verify(args, cp)
  console.log('[climatology] ingesta terminada. Ejecuta el compilador para consolidar estadísticas.')
}

main().catch((err) => {
  console.error('[climatology] failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
