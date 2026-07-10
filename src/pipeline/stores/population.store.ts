import type { PopulationWarningCode } from '@/modules/territory/population/population.types'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export type PopulationContextStatus = 'complete' | 'partial' | 'unavailable' | 'error' | 'stale'

export interface PopulationContextRow {
  id: string
  entity_type: string
  entity_id: string
  context_version: string
  source_dataset_id: string | null
  reference_year: number
  analysis_geometry_type: string | null
  geometry_source: string | null
  estimated_population: number | null
  validation_summary: Record<string, unknown>
  official_population_context: Record<string, unknown>
  nearest_settlements: unknown[]
  status: PopulationContextStatus
  warnings: PopulationWarningCode[]
  generated_at: string
  updated_at: string
}

export interface PopulationZoneRow {
  id: string
  context_id: string
  radius_m: number
  estimated_population: number
  validation_estimate: number | null
  absolute_difference: number | null
  difference_pct: number | null
  population_density_per_km2: number | null
  analyzed_area_ha: number | null
  data_coverage_pct: number | null
  warnings: PopulationWarningCode[]
  generated_at: string
}

export interface PopulationEventCandidate {
  id: string
  department_code: string | null
  department_name: string | null
  status: string
  detection_count: number
  centroid_lat: number | null
  centroid_lng: number | null
  last_linked_at: string | null
  context_version: string | null
  context_generated_at: string | null
}

export interface PersistPopulationContextInput {
  entityType: string
  entityId: string
  contextVersion: string
  referenceYear: number
  geometrySource: 'detections' | 'event_centroid_fallback'
  status: PopulationContextStatus
  estimatedPopulation: number | null
  validationSummary: Record<string, unknown>
  officialContext: Record<string, unknown>
  nearestSettlements: unknown[]
  warnings: PopulationWarningCode[]
  generatedAt: string
  zones: Array<{
    radiusM: number
    estimatedPopulation: number
    validationEstimate?: number
    absoluteDifference?: number
    differencePct?: number
    densityPerKm2: number
    analyzedAreaHa: number
    dataCoveragePct: number
    warnings: PopulationWarningCode[]
  }>
}

export async function listPopulationEventCandidates(
  limit: number,
): Promise<PopulationEventCandidate[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('fire_events')
    .select(
      `
      id,
      status,
      detection_count,
      centroid_lat,
      centroid_lng,
      geo_departments!fire_events_department_id_fkey (code, name),
      fire_event_detections (linked_at)
    `,
    )
    .order('last_detected_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  const eventIds = (data ?? []).map((r) => r.id as string)
  const contexts = await getLatestPopulationContextsForEvents(eventIds)

  return (data ?? []).map((row) => {
    const dept = row.geo_departments as { code?: string; name?: string } | Array<{ code?: string; name?: string }> | null
    const deptRow = Array.isArray(dept) ? dept[0] : dept
    const links = (row.fire_event_detections ?? []) as Array<{ linked_at?: string }>
    const lastLinked = links
      .map((l) => l.linked_at)
      .filter((v): v is string => Boolean(v))
      .sort()
      .at(-1) ?? null
    const ctx = contexts.get(String(row.id))

    return {
      id: row.id as string,
      department_code: deptRow?.code ?? null,
      department_name: deptRow?.name ?? null,
      status: String(row.status ?? 'new'),
      detection_count: Number(row.detection_count ?? 0),
      centroid_lat: row.centroid_lat != null ? Number(row.centroid_lat) : null,
      centroid_lng: row.centroid_lng != null ? Number(row.centroid_lng) : null,
      last_linked_at: lastLinked,
      context_version: ctx?.context_version ?? null,
      context_generated_at: ctx?.generated_at ?? null,
    }
  })
}

async function getLatestPopulationContextsForEvents(
  eventIds: string[],
): Promise<Map<string, { context_version: string; generated_at: string }>> {
  const map = new Map<string, { context_version: string; generated_at: string }>()
  if (!eventIds.length) return map

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('entity_population_context')
    .select('entity_id, context_version, generated_at')
    .eq('entity_type', 'fire_event')
    .in('entity_id', eventIds)
    .order('generated_at', { ascending: false })

  if (error) throw new Error(error.message)
  for (const row of data ?? []) {
    const id = String(row.entity_id)
    if (!map.has(id)) {
      map.set(id, {
        context_version: String(row.context_version),
        generated_at: String(row.generated_at),
      })
    }
  }
  return map
}

export async function getLatestPopulationContext(
  eventId: string,
): Promise<PopulationContextRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('entity_population_context')
    .select('*')
    .eq('entity_type', 'fire_event')
    .eq('entity_id', eventId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as PopulationContextRow | null) ?? null
}

export async function getPopulationZones(contextId: string): Promise<PopulationZoneRow[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('entity_population_zones')
    .select('*')
    .eq('context_id', contextId)
    .order('radius_m', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as PopulationZoneRow[]) ?? []
}

export async function persistPopulationContext(
  input: PersistPopulationContextInput,
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  const { data: ctxRow, error: ctxError } = await supabase
    .from('entity_population_context')
    .upsert(
      {
        entity_type: input.entityType,
        entity_id: input.entityId,
        context_version: input.contextVersion,
        reference_year: input.referenceYear,
        analysis_geometry_type: 'buffer_union',
        geometry_source: input.geometrySource,
        estimated_population: input.estimatedPopulation,
        validation_summary: input.validationSummary,
        official_population_context: input.officialContext,
        nearest_settlements: input.nearestSettlements,
        status: input.status,
        warnings: input.warnings,
        generated_at: input.generatedAt,
        updated_at: now,
      },
      { onConflict: 'entity_type,entity_id,context_version' },
    )
    .select('id')
    .single()

  if (ctxError) throw new Error(ctxError.message)
  const contextId = ctxRow.id as string

  const { error: delError } = await supabase
    .from('entity_population_zones')
    .delete()
    .eq('context_id', contextId)
  if (delError) throw new Error(delError.message)

  if (!input.zones.length) return

  const zoneRows = input.zones.map((zone) => ({
    context_id: contextId,
    radius_m: zone.radiusM,
    estimated_population: zone.estimatedPopulation,
    validation_estimate: zone.validationEstimate ?? null,
    absolute_difference: zone.absoluteDifference ?? null,
    difference_pct: zone.differencePct ?? null,
    population_density_per_km2: zone.densityPerKm2,
    analyzed_area_ha: zone.analyzedAreaHa,
    data_coverage_pct: zone.dataCoveragePct,
    warnings: zone.warnings,
    generated_at: input.generatedAt,
  }))

  const { error: zoneError } = await supabase.from('entity_population_zones').insert(zoneRows)
  if (zoneError) throw new Error(zoneError.message)
}
