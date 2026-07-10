/**
 * Agrupación espacio-temporal de detecciones FIRMS en eventos térmicos.
 *
 * Por defecto: dry-run (sin escritura).
 * Escritura real: requiere --write explícito + service role.
 *
 *   npm run fires:cluster:dry
 *   npm run fires:cluster -- --write
 *   npm run fires:cluster -- --limit 1000
 *   npm run fires:cluster -- --force --write
 */
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { CLUSTER_CONFIG } from '@/pipeline/engines/fire/cluster.config'
import { runClusterPipeline } from '@/pipeline/engines/fire/cluster.pipeline'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

config({ path: resolve(process.cwd(), '.env') })

function parseArgs(argv: string[]): {
  dryRun: boolean
  write: boolean
  force: boolean
  limit?: number
} {
  const write = argv.includes('--write')
  const dryRun = argv.includes('--dry-run') || (!write && process.env.FIRES_CLUSTER_DRY === '1')
  const force = argv.includes('--force')
  let limit: number | undefined

  const limitIdx = argv.findIndex((a) => a === '--limit')
  if (limitIdx >= 0) {
    const value = Number(argv[limitIdx + 1])
    if (!Number.isFinite(value) || value < 1) {
      console.error('❌ --limit requiere un entero >= 1')
      process.exit(1)
    }
    limit = Math.min(value, 10000)
  }

  if (force && limit !== undefined) {
    console.error('❌ No se permite combinar --force con --limit')
    process.exit(1)
  }

  return { dryRun: dryRun && !write, write, force, limit }
}

function printDryRun(result: Awaited<ReturnType<typeof runClusterPipeline>>) {
  console.log('\n🔍 FIRMS cluster dry-run')
  console.log(`Model: ${CLUSTER_CONFIG.clusterModelVersion}`)
  console.log(
    `Thresholds: ${CLUSTER_CONFIG.distanceThresholdM}m / ${CLUSTER_CONFIG.timeThresholdHours}h`,
  )
  console.log(`Detections considered: ${result.metrics.detections_considered}`)
  console.log(`Clusters found: ${result.metrics.clusters_found}`)

  for (const cluster of result.clusters) {
    console.log(`\n── Cluster ${cluster.cluster_index} (${cluster.proposed_action}) ──`)
    console.log(`  Detections: ${cluster.detection_ids.length}`)
    console.log(`  Max internal distance: ~${cluster.max_internal_distance_m_approx} m`)
    console.log(`  Time span: ${cluster.time_span_hours} h`)
    console.log(`  Satellites: ${cluster.satellites.join(', ')}`)
    console.log(
      `  Department: ${cluster.cross_department ? 'CROSS' : (cluster.department ?? '—')}`,
    )
    console.log(
      `  validation=${cluster.validation_status} risk=${cluster.risk_level} priority=${cluster.priority_score}`,
    )
    if (cluster.existing_event_id) {
      console.log(`  Existing event: ${cluster.existing_event_id}`)
    }
    for (const m of cluster.members) {
      console.log(
        `    · ${m.lat.toFixed(4)}, ${m.lng.toFixed(4)} | ${m.source_product} | ` +
          `${m.satellite_normalized} | ${m.department_name ?? '—'}`,
      )
    }
  }

  console.log('\n📊 Métricas (proyectadas)')
  const m = result.metrics
  console.log(`  events_created: ${m.events_created}`)
  console.log(`  events_updated: ${m.events_updated}`)
  console.log(`  Database writes: 0`)
  console.log(`  Duration: ${m.duration_ms}ms`)
}

function printWriteResult(result: Awaited<ReturnType<typeof runClusterPipeline>>) {
  console.log('\n✅ FIRMS cluster — escritura real')
  const m = result.metrics
  console.log(`  events_created: ${m.events_created}`)
  console.log(`  events_updated: ${m.events_updated}`)
  console.log(`  events_merged: ${m.events_merged}`)
  console.log(`  detections_newly_linked: ${m.detections_newly_linked}`)
  console.log(`  Duration: ${m.duration_ms}ms`)
}

async function runVerifications() {
  const supabase = getSupabaseAdmin()
  console.log('\n🔎 Verificaciones post-ejecución')

  const { count: nationalCount } = await supabase
    .from('fire_detections')
    .select('*', { count: 'exact', head: true })
    .eq('is_inside_guatemala', true)

  const { data: allLinks } = await supabase
    .from('fire_event_detections')
    .select('detection_id')

  const { data: nationalDets } = await supabase
    .from('fire_detections')
    .select('id')
    .eq('is_inside_guatemala', true)

  const nationalIds = new Set((nationalDets ?? []).map((d) => d.id as string))
  const linkedNational = (allLinks ?? []).filter((l) =>
    nationalIds.has(l.detection_id as string),
  ).length

  console.log(`  1. Nacional: ${nationalCount} | Vinculadas: ${linkedNational}`)

  const { count: eventCount } = await supabase
    .from('fire_events')
    .select('*', { count: 'exact', head: true })

  console.log(`  2. Total eventos: ${eventCount}`)

  const { data: events } = await supabase
    .from('fire_events')
    .select(
      'id, status, validation_status, risk_level, priority_score, detection_count, satellite_count, source_products, max_frp_mw, persistence_hours, geometry_method, estimated_area_ha, first_detected_at, last_detected_at, department_id, centroid',
    )

  const { data: departments } = await supabase
    .from('geo_departments')
    .select('id, name')

  const deptMap = new Map((departments ?? []).map((d) => [d.id as string, d.name as string]))

  const { data: linkCounts } = await supabase.from('fire_event_detections').select('event_id')

  const eventLinkCount = new Map<string, number>()
  for (const l of linkCounts ?? []) {
    const eid = l.event_id as string
    eventLinkCount.set(eid, (eventLinkCount.get(eid) ?? 0) + 1)
  }

  let countMismatch = 0
  for (const e of events ?? []) {
    const linked = eventLinkCount.get(e.id as string) ?? 0
    if (e.detection_count !== linked) countMismatch++
  }
  console.log(`  3. Consistencia detection_count: ${countMismatch === 0 ? 'OK (0)' : `FALLO (${countMismatch})`}`)

  const detCounts = new Map<string, number>()
  for (const row of allLinks ?? []) {
    const id = row.detection_id as string
    detCounts.set(id, (detCounts.get(id) ?? 0) + 1)
  }
  const dups = [...detCounts.values()].filter((c) => c > 1).length
  console.log(`  4. Detecciones duplicadas: ${dups}`)

  console.log('\n  5. Eventos')
  for (const e of events ?? []) {
    const dept = e.department_id ? deptMap.get(e.department_id as string) : null
    const shortId = (e.id as string).slice(0, 8)
    console.log(
      `     ${shortId}… | ${dept ?? '—'} | ${e.status} | ${e.validation_status} | ` +
        `${e.risk_level} | score=${e.priority_score} | det=${e.detection_count} | ` +
        `sats=${e.satellite_count} | ${e.geometry_method} | ${e.estimated_area_ha} ha | ` +
        `centroid=${e.centroid ? 'yes' : 'no'}`,
    )
  }
}

async function main() {
  if (!process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error('❌ SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas.')
    process.exit(1)
  }

  const { dryRun, write, force, limit } = parseArgs(process.argv.slice(2))

  if (write) {
    console.log('🔐 Modo escritura: service role · transacción RPC · rollback automático si falla')
  }

  if (force && write) {
    console.warn('⚠️  Modo FORCE: reconstrucción de eventos no confirmados')
  }

  const result = await runClusterPipeline({
    dryRun: !write,
    force,
    limit,
  })

  if (dryRun) {
    printDryRun(result)
    return
  }

  printWriteResult(result)
  await runVerifications()
}

main().catch((err) => {
  console.error('❌ Error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
