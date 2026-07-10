/**
 * Clasifica geografía de detecciones FIRMS (PostGIS).
 * Uso:
 *   npm run fires:geocode
 *   npm run fires:geocode -- --limit 100
 *   npm run fires:geocode -- --force
 */
import { config } from 'dotenv'
import { resolve } from 'node:path'
import {
  fetchGeographyDiagnostics,
  runFireGeographyClassification,
  runVerificationQueries,
} from '@/pipeline/engines/fire/geography.engine'

config({ path: resolve(process.cwd(), '.env') })

function parseArgs(argv: string[]): { limit: number; force: boolean } {
  let limit = 10000
  let force = process.env.FIRES_GEOCODE_FORCE === '1' || process.env.FIRES_GEOCODE_FORCE === 'true'

  const limitIdx = argv.findIndex((a) => a === '--limit')
  if (limitIdx >= 0) {
    const value = Number(argv[limitIdx + 1])
    if (!Number.isFinite(value) || value < 1) {
      console.error('❌ --limit requiere un entero >= 1')
      process.exit(1)
    }
    limit = Math.min(value, 10000)
  }

  if (argv.includes('--force')) force = true

  return { limit, force }
}

function printDiagnosticsTable(rows: Awaited<ReturnType<typeof fetchGeographyDiagnostics>>) {
  console.log('\n📍 Diagnóstico de detecciones')
  console.log(
    'lat\t\tlng\t\tfuente\t\t\tinside\tdepto\t\tmétodo\t\tadvertencia',
  )
  for (const r of rows) {
    console.log(
      `${r.latitude.toFixed(4)}\t${r.longitude.toFixed(4)}\t${r.source_product.padEnd(16)}\t` +
        `${String(r.is_inside_guatemala)}\t${(r.department ?? '-').padEnd(12)}\t` +
        `${r.geography_method}\t${r.warning ?? '-'}`,
    )
  }
}

async function main() {
  if (!process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error('❌ SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas.')
    process.exit(1)
  }

  const { limit, force } = parseArgs(process.argv.slice(2))

  console.log('🗺️  Clasificación geográfica FIRMS (Commit 3A)')
  if (force) console.log('   Modo: FORCE (reclasificación administrativa)')

  const metrics = await runFireGeographyClassification({ limit, force })

  console.log('\n📊 Métricas')
  console.log(`Evaluated: ${metrics.evaluated}`)
  console.log(`Inside Guatemala: ${metrics.inside_guatemala}`)
  console.log(`Outside Guatemala: ${metrics.outside_guatemala}`)
  console.log(`Departments assigned: ${metrics.departments_assigned}`)
  console.log(`No department match: ${metrics.no_department_match}`)
  console.log(`Multiple department matches: ${metrics.multiple_department_matches}`)
  console.log(`Boundary matches: ${metrics.boundary_matches}`)
  console.log(`Unresolved: ${metrics.unresolved}`)
  console.log(`Forced: ${metrics.forced}`)
  if (metrics.forced) console.log(`Reprocessed: ${metrics.reprocessed}`)
  console.log(`Duration: ${metrics.duration_ms}ms`)

  const diagnostics = await fetchGeographyDiagnostics()
  printDiagnosticsTable(diagnostics)

  const verification = await runVerificationQueries()
  console.log('\n🔎 Verificación SQL')
  console.log(`geo_departments: ${verification.geo_departments_count}`)
  const s = verification.fire_detections_summary as {
    total: number
    inside: number
    outside: number
    unresolved: number
  }
  console.log(
    `fire_detections: total=${s.total} inside=${s.inside} outside=${s.outside} unresolved=${s.unresolved}`,
  )
  console.log('geography_method distribution:', verification.geography_method_distribution)
  console.log('department distribution:')
  for (const d of verification.department_distribution as Array<{ name: string; detections: number }>) {
    if (d.detections > 0) console.log(`  ${d.name}: ${d.detections}`)
  }
}

main().catch((err) => {
  console.error('❌ Error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
