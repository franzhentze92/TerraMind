/**
 * Enriquecimiento de contexto territorial — áreas protegidas SIGAP.
 */
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { runProtectedAreasEnrichment } from '@/pipeline/engines/fire/context/protected-areas.engine'
import {
  formatDistanceM,
  proximityLabelText,
  computeProximityLabel,
} from '@/modules/fires/utils/proximity-label'

config({ path: resolve(process.cwd(), '.env') })

function parseArgs(argv: string[]): { limit: number; force: boolean } {
  let limit = 10000
  let force = false

  const limitIdx = argv.findIndex((a) => a === '--limit')
  if (limitIdx >= 0) {
    const value = Number(argv[limitIdx + 1])
    if (!Number.isFinite(value) || value < 1) {
      console.error('❌ --limit requiere un entero >= 1')
      process.exit(1)
    }
    limit = value
  }

  if (argv.includes('--force')) force = true

  return { limit, force }
}

async function main() {
  if (!process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error('❌ SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas.')
    process.exit(1)
  }

  const { limit, force } = parseArgs(process.argv.slice(2))

  console.log('🛡️  Enriquecimiento áreas protegidas (Commit 7A.1.1)')
  if (force) console.log('   Modo: FORCE')

  const metrics = await runProtectedAreasEnrichment({ limit, force })

  console.log('\n📊 Métricas')
  console.log(JSON.stringify({
    events_considered: metrics.events_considered,
    events_enriched: metrics.events_enriched,
    events_unchanged: metrics.events_unchanged,
    events_failed: metrics.events_failed,
    inside_protected_area_count: metrics.inside_protected_area_count,
    duration_ms: metrics.duration_ms,
    context_version: metrics.context_version,
  }, null, 2))

  if (metrics.results.length > 0) {
    console.log('\n📍 Eventos enriquecidos')
    for (const r of metrics.results) {
      const proximity = proximityLabelText(
        computeProximityLabel(r.nearest_distance_m, r.inside_protected_area),
      )
      console.log(
        `${r.department_name ?? '-'}\tinside=${r.inside_protected_area}\t` +
          `det=${r.detections_inside}\t${r.nearest_display_name ?? '-'}\t` +
          `${formatDistanceM(r.nearest_distance_m)}\t${proximity}`,
      )
    }
  }
}

main().catch((err) => {
  console.error('❌ Error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
