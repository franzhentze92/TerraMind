/**
 * Enriquecimiento asíncrono de cobertura del suelo para eventos térmicos.
 */
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { runLandCoverEnrichment } from '@/pipeline/engines/fire/context/land-cover.engine'

config({ path: resolve(process.cwd(), '.env') })

function parseArgs(argv: string[]): {
  limit: number
  force: boolean
  eventId?: string
} {
  let limit = 10000
  let force = false
  let eventId: string | undefined

  const limitIdx = argv.findIndex((a) => a === '--limit')
  if (limitIdx >= 0) {
    const value = Number(argv[limitIdx + 1])
    if (!Number.isFinite(value) || value < 1) {
      console.error('❌ --limit requiere un entero >= 1')
      process.exit(1)
    }
    limit = value
  }

  const eventIdx = argv.findIndex((a) => a === '--event')
  if (eventIdx >= 0) {
    eventId = argv[eventIdx + 1]
    if (!eventId) {
      console.error('❌ --event requiere un UUID')
      process.exit(1)
    }
  }

  if (argv.includes('--force')) force = true

  return { limit, force, eventId }
}

async function main() {
  if (!process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error('❌ SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas.')
    process.exit(1)
  }

  const { limit, force, eventId } = parseArgs(process.argv.slice(2))

  console.log('🌿 Enriquecimiento cobertura del suelo — eventos térmicos (7A.2-D)')
  if (force) console.log('   Modo: FORCE')
  if (eventId) console.log(`   Evento: ${eventId}`)

  const metrics = await runLandCoverEnrichment({ limit, force, eventId })

  console.log(
    JSON.stringify(
      {
        event: 'land_cover_enrichment_complete',
        events_considered: metrics.events_considered,
        events_enriched: metrics.events_enriched,
        events_unchanged: metrics.events_unchanged,
        events_failed: metrics.events_failed,
        centroid_fallback_count: metrics.centroid_fallback_count,
        incomplete_coverage_count: metrics.incomplete_coverage_count,
        duration_ms: metrics.duration_ms,
        context_version: metrics.context_version,
        radii_m: metrics.radii_m,
        results: metrics.results,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      event: 'land_cover_enrichment_error',
      message: err instanceof Error ? err.message : String(err),
    }),
  )
  process.exit(1)
})
