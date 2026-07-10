import { createHash } from 'node:crypto'
import {
  CONAP_SIGAP_LAYER_CODE,
  buildContextVersion,
} from '@/pipeline/geo/conap-sigap'
import {
  countTerritorialFeatures,
  enrichEventProtectedAreaContext,
  getTerritorialLayer,
  type FireEventContextRow,
} from '@/pipeline/stores/territorial.store'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export interface ProtectedAreasEnrichOptions {
  limit?: number
  force?: boolean
}

export interface ProtectedAreasEnrichMetrics {
  events_considered: number
  events_enriched: number
  events_unchanged: number
  events_failed: number
  inside_protected_area_count: number
  duration_ms: number
  context_version: string
  layer_available: boolean
  forced: boolean
  results: ProtectedAreaEnrichResultRow[]
}

export interface ProtectedAreaEnrichResultRow {
  event_id: string
  department_name: string | null
  inside_protected_area: boolean | null
  detections_inside: number
  nearest_display_name: string | null
  nearest_distance_m: number | null
  diagnostic_overlap: boolean | null
  status: string
}

export class ProtectedAreasLayerUnavailableError extends Error {
  constructor(message = 'Capa gt_protected_areas no disponible') {
    super(message)
    this.name = 'ProtectedAreasLayerUnavailableError'
  }
}

async function resolveContextVersion(): Promise<{
  contextVersion: string
  sourceVersions: Record<string, unknown>
  layerAvailable: boolean
}> {
  const layer = await getTerritorialLayer(CONAP_SIGAP_LAYER_CODE)
  if (!layer) {
    return { contextVersion: 'unavailable', sourceVersions: {}, layerAvailable: false }
  }

  const featureCount = await countTerritorialFeatures(CONAP_SIGAP_LAYER_CODE)
  if (featureCount === 0) {
    return { contextVersion: 'unavailable', sourceVersions: {}, layerAvailable: false }
  }

  const artifactHash = createHash('sha256')
    .update(`${layer.source_version}|${featureCount}`)
    .digest('hex')
    .slice(0, 16)

  const contextVersion = buildContextVersion(layer.source_version, featureCount, artifactHash)

  return {
    contextVersion,
    sourceVersions: {
      gt_protected_areas: {
        source: 'CONAP SIGAP',
        version: layer.source_version,
        date: layer.source_date,
        feature_count: featureCount,
      },
    },
    layerAvailable: true,
  }
}

interface EventCandidate {
  id: string
  department_name: string | null
  detection_count: number
  last_linked_at: string | null
  context_version: string | null
  context_generated_at: string | null
}

async function listEventCandidates(limit: number): Promise<EventCandidate[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('fire_events')
    .select(
      `
      id,
      detection_count,
      geo_departments!fire_events_department_id_fkey (name),
      fire_event_context (context_version, generated_at),
      fire_event_detections (linked_at)
    `,
    )
    .order('last_detected_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const dept = row.geo_departments as { name?: string } | { name?: string }[] | null
    const department_name = Array.isArray(dept) ? dept[0]?.name ?? null : dept?.name ?? null
    const ctxRaw = row.fire_event_context as
      | { context_version?: string; generated_at?: string }
      | { context_version?: string; generated_at?: string }[]
      | null
    const ctx = Array.isArray(ctxRaw) ? ctxRaw[0] : ctxRaw
    const links = (row.fire_event_detections ?? []) as Array<{ linked_at?: string }>
    const lastLinked = links
      .map((l) => l.linked_at)
      .filter((v): v is string => Boolean(v))
      .sort()
      .at(-1) ?? null

    return {
      id: row.id as string,
      department_name,
      detection_count: Number(row.detection_count ?? 0),
      last_linked_at: lastLinked,
      context_version: ctx?.context_version ?? null,
      context_generated_at: ctx?.generated_at ?? null,
    }
  })
}

function eventNeedsEnrichment(
  event: EventCandidate,
  contextVersion: string,
  force: boolean,
): boolean {
  if (force) return true
  if (!event.context_version) return true
  if (event.context_version !== contextVersion) return true
  if (
    event.last_linked_at &&
    event.context_generated_at &&
    event.last_linked_at > event.context_generated_at
  ) {
    return true
  }
  return false
}

function toResultRow(
  event: EventCandidate,
  ctx: FireEventContextRow,
): ProtectedAreaEnrichResultRow {
  return {
    event_id: event.id,
    department_name: event.department_name,
    inside_protected_area: ctx.inside_protected_area,
    detections_inside: ctx.detections_inside_protected_area_count,
    nearest_display_name: ctx.nearest_protected_area_name,
    nearest_distance_m:
      ctx.nearest_protected_area_distance_m != null
        ? Number(ctx.nearest_protected_area_distance_m)
        : null,
    diagnostic_overlap: ctx.diagnostic_geometry_intersects_protected_area,
    status: ctx.protected_area_context_status,
  }
}

export async function runProtectedAreasEnrichment(
  options: ProtectedAreasEnrichOptions = {},
): Promise<ProtectedAreasEnrichMetrics> {
  const started = Date.now()
  const limit = options.limit ?? 10000
  const force = options.force ?? false

  const { contextVersion, sourceVersions, layerAvailable } = await resolveContextVersion()

  const metrics: ProtectedAreasEnrichMetrics = {
    events_considered: 0,
    events_enriched: 0,
    events_unchanged: 0,
    events_failed: 0,
    inside_protected_area_count: 0,
    duration_ms: 0,
    context_version: contextVersion,
    layer_available: layerAvailable,
    forced: force,
    results: [],
  }

  if (!layerAvailable) {
    metrics.duration_ms = Date.now() - started
    throw new ProtectedAreasLayerUnavailableError()
  }

  const candidates = await listEventCandidates(limit)
  metrics.events_considered = candidates.length

  for (const event of candidates) {
    if (!eventNeedsEnrichment(event, contextVersion, force)) {
      metrics.events_unchanged += 1
      continue
    }

    try {
      const ctx = await enrichEventProtectedAreaContext(
        event.id,
        contextVersion,
        sourceVersions,
      )
      metrics.events_enriched += 1
      if (ctx.inside_protected_area) metrics.inside_protected_area_count += 1
      metrics.results.push(toResultRow(event, ctx))
    } catch {
      metrics.events_failed += 1
    }
  }

  metrics.duration_ms = Date.now() - started
  return metrics
}
