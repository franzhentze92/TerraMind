import type { ClimateEventWarningCode } from '@/modules/climate/services/climate-event-query.service'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export type ClimateContextStatus = 'complete' | 'partial' | 'unavailable' | 'error' | 'stale'

export interface ClimateContextRow {
  id: string
  entity_type: string
  entity_id: string
  context_version: string
  status: ClimateContextStatus
  provider: string
  model_name: string
  generated_at: string
  event_time_start: string | null
  event_time_end: string | null
  geometry_source: string | null
  point_count: number
  temporal_alignment: string | null
  conditions_summary: Record<string, unknown>
  antecedent_summary: Record<string, unknown>
  forecast_summary: Record<string, unknown>
  source_metadata: Record<string, unknown>
  warnings: ClimateEventWarningCode[]
  created_at: string
  updated_at: string
}

export interface ClimateContextPointRow {
  id: string
  context_id: string
  point_role: string
  latitude: number
  longitude: number
  event_timestamp: string
  matched_weather_timestamp: string | null
  temporal_offset_minutes: number | null
  conditions: Record<string, unknown>
  created_at: string
}

export interface ClimateEventCandidate {
  id: string
  department_code: string | null
  department_name: string | null
  status: string
  detection_count: number
  centroid_lat: number | null
  centroid_lng: number | null
  first_detected_at: string | null
  last_detected_at: string | null
  last_linked_at: string | null
  context_version: string | null
  context_generated_at: string | null
}

export interface PersistClimateContextInput {
  entityType: string
  entityId: string
  contextVersion: string
  status: ClimateContextStatus
  provider: string
  modelName: string
  generatedAt: string
  eventTimeStart: string | null
  eventTimeEnd: string | null
  geometrySource: 'detections_sample' | 'event_centroid_fallback'
  pointCount: number
  temporalAlignment: 'exact' | 'partial' | 'mismatch'
  conditionsSummary: Record<string, unknown>
  antecedentSummary: Record<string, unknown>
  forecastSummary: Record<string, unknown>
  sourceMetadata: Record<string, unknown>
  warnings: ClimateEventWarningCode[]
  points: Array<{
    role: string
    lat: number
    lon: number
    eventTimestamp: string
    matchedWeatherTimestamp: string | null
    temporalOffsetMinutes: number | null
    conditions: Record<string, unknown>
  }>
}

async function getLatestClimateContextsForEvents(
  eventIds: string[],
): Promise<Map<string, { context_version: string; generated_at: string }>> {
  const map = new Map<string, { context_version: string; generated_at: string }>()
  if (!eventIds.length) return map

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('entity_climate_context')
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

export async function fetchClimateEventDetections(
  eventId: string,
): Promise<Array<{ id: string; latitude: number; longitude: number; acquired_at_utc: string }>> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('fire_event_detections')
    .select('detection_id, fire_detections (id, latitude, longitude, acquired_at_utc)')
    .eq('event_id', eventId)

  if (error) throw new Error(error.message)

  const points: Array<{ id: string; latitude: number; longitude: number; acquired_at_utc: string }> = []
  for (const link of data ?? []) {
    const raw = link.fire_detections as
      | { id?: string; latitude?: number; longitude?: number; acquired_at_utc?: string }
      | Array<{ id?: string; latitude?: number; longitude?: number; acquired_at_utc?: string }>
      | null
    const det = Array.isArray(raw) ? raw[0] : raw
    if (!det?.id || det.acquired_at_utc == null) continue
    points.push({
      id: String(det.id),
      latitude: Number(det.latitude),
      longitude: Number(det.longitude),
      acquired_at_utc: String(det.acquired_at_utc),
    })
  }
  return points.sort((a, b) => a.acquired_at_utc.localeCompare(b.acquired_at_utc))
}

export async function listClimateEventCandidates(limit: number): Promise<ClimateEventCandidate[]> {
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
      first_detected_at,
      last_detected_at,
      geo_departments!fire_events_department_id_fkey (code, name),
      fire_event_detections (linked_at)
    `,
    )
    .order('last_detected_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  const eventIds = (data ?? []).map((r) => r.id as string)
  const contexts = await getLatestClimateContextsForEvents(eventIds)

  return (data ?? []).map((row) => {
    const dept = row.geo_departments as { code?: string; name?: string } | Array<{ code?: string; name?: string }> | null
    const deptRow = Array.isArray(dept) ? dept[0] : dept
    const links = (row.fire_event_detections ?? []) as Array<{ linked_at?: string }>
    const lastLinked =
      links
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
      first_detected_at: row.first_detected_at ? String(row.first_detected_at) : null,
      last_detected_at: row.last_detected_at ? String(row.last_detected_at) : null,
      last_linked_at: lastLinked,
      context_version: ctx?.context_version ?? null,
      context_generated_at: ctx?.generated_at ?? null,
    }
  })
}

export async function getLatestClimateContext(eventId: string): Promise<ClimateContextRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('entity_climate_context')
    .select('*')
    .eq('entity_type', 'fire_event')
    .eq('entity_id', eventId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as ClimateContextRow | null) ?? null
}

export async function getClimateContextPoints(contextId: string): Promise<ClimateContextPointRow[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('entity_climate_context_points')
    .select('*')
    .eq('context_id', contextId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as ClimateContextPointRow[]) ?? []
}

export async function persistClimateContext(input: PersistClimateContextInput): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  const { data: ctxRow, error: ctxError } = await supabase
    .from('entity_climate_context')
    .upsert(
      {
        entity_type: input.entityType,
        entity_id: input.entityId,
        context_version: input.contextVersion,
        status: input.status,
        provider: input.provider,
        model_name: input.modelName,
        generated_at: input.generatedAt,
        event_time_start: input.eventTimeStart,
        event_time_end: input.eventTimeEnd,
        geometry_source: input.geometrySource,
        point_count: input.pointCount,
        temporal_alignment: input.temporalAlignment,
        conditions_summary: input.conditionsSummary,
        antecedent_summary: input.antecedentSummary,
        forecast_summary: input.forecastSummary,
        source_metadata: input.sourceMetadata,
        warnings: input.warnings,
        updated_at: now,
      },
      { onConflict: 'entity_type,entity_id,context_version' },
    )
    .select('id')
    .single()

  if (ctxError) throw new Error(ctxError.message)
  const contextId = ctxRow.id as string

  const { error: delError } = await supabase
    .from('entity_climate_context_points')
    .delete()
    .eq('context_id', contextId)
  if (delError) throw new Error(delError.message)

  if (!input.points.length) return

  const pointRows = input.points.map((point) => ({
    context_id: contextId,
    point_role: point.role,
    latitude: point.lat,
    longitude: point.lon,
    event_timestamp: point.eventTimestamp,
    matched_weather_timestamp: point.matchedWeatherTimestamp,
    temporal_offset_minutes: point.temporalOffsetMinutes,
    conditions: point.conditions,
  }))

  const { error: pointError } = await supabase.from('entity_climate_context_points').insert(pointRows)
  if (pointError) throw new Error(pointError.message)
}
