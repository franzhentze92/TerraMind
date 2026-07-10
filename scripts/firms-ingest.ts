/**
 * Ingesta FIRMS → Supabase (auditoría + upsert).
 * Uso:
 *   npm run firms:ingest
 *   npm run firms:ingest -- --dry-run
 *   npm run firms:ingest -- --source VIIRS_SNPP_NRT
 */
import { config } from 'dotenv'
import { resolve } from 'node:path'
import {
  FIRMS_INGEST_SOURCES,
  type FirmsSourceProduct,
} from '@/pipeline/connectors/firms.config'
import { runFireIngestion } from '@/pipeline/engines/fire/ingest.engine'

config({ path: resolve(process.cwd(), '.env') })

function parseArgs(argv: string[]): { dryRun: boolean; sources?: FirmsSourceProduct[] } {
  const dryRun =
    argv.includes('--dry-run') ||
    process.env.FIRMS_DRY_RUN === '1' ||
    process.env.FIRMS_DRY_RUN === 'true'
  const sourceIdx = argv.findIndex((a) => a === '--source')
  let sources: FirmsSourceProduct[] | undefined

  if (sourceIdx >= 0) {
    const value = argv[sourceIdx + 1]
    if (!value || value.startsWith('--')) {
      console.error('❌ --source requiere un valor (ej. VIIRS_SNPP_NRT)')
      process.exit(1)
    }
    if (!FIRMS_INGEST_SOURCES.includes(value as FirmsSourceProduct)) {
      console.error(`❌ Fuente desconocida: ${value}`)
      console.error(`   Válidas: ${FIRMS_INGEST_SOURCES.join(', ')}`)
      process.exit(1)
    }
    sources = [value as FirmsSourceProduct]
  }

  return { dryRun, sources }
}

async function main() {
  const { dryRun, sources } = parseArgs(process.argv.slice(2))
  const activeSources = sources ?? [...FIRMS_INGEST_SOURCES]

  if (!process.env.NASA_FIRMS_MAP_KEY?.trim()) {
    console.error('❌ NASA_FIRMS_MAP_KEY no configurada.')
    process.exit(1)
  }

  if (!dryRun) {
    if (!process.env.SUPABASE_URL?.trim()) {
      console.error('❌ SUPABASE_URL no configurada.')
      process.exit(1)
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      console.error('❌ SUPABASE_SERVICE_ROLE_KEY no configurada.')
      process.exit(1)
    }
  }

  if (dryRun) {
    console.log('FIRMS ingestion dry-run')
  } else {
    console.log('FIRMS ingestion')
  }

  const result = await runFireIngestion({ dryRun, sources: activeSources })

  console.log(`Sources: ${activeSources.length}`)

  for (const s of result.sources) {
    if (s.error) {
      console.log(`${s.source}: FAILED (${s.error})`)
    } else {
      console.log(`${s.source}: ${s.rowsValid} valid`)
    }
  }

  console.log(`Rows received: ${result.rowsReceived}`)
  console.log(`Rows valid: ${result.rowsValid}`)
  console.log(`Rows rejected: ${result.rowsRejected}`)

  if (dryRun) {
    console.log('Database writes: 0')
  } else {
    console.log(`Inserted: ${result.rowsInserted}`)
    console.log(`Updated: ${result.rowsUpdated}`)
    console.log(`Duplicated: ${result.rowsDuplicated}`)
    console.log(`Status: ${result.status}`)
    if (result.runId) {
      console.log(`Run ID: ${result.runId}`)
    }
    console.log(`Duration: ${result.durationMs}ms`)
  }

  if (result.errors.length > 0 && !dryRun) {
    process.exit(result.status === 'failed' ? 1 : 0)
  }
}

main().catch((err) => {
  console.error('❌ Error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
