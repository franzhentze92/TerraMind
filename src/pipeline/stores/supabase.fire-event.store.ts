import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import { CLUSTER_CONFIG } from '@/pipeline/engines/fire/cluster.config'
import type { ClusterDetection, ExistingEvent } from '@/pipeline/stores/fire-event.types'

export interface ClusterOptions {
  dryRun?: boolean
  force?: boolean
  limit?: number
}

const NATIONAL_FILTER = {
  is_inside_guatemala: true,
  geography_method: 'postgis_polygon',
  geography_confidence: 'high',
} as const

export async function fetchNationalDetections(
  limit: number,
  excludeDetectionIds: Set<string> = new Set(),
): Promise<ClusterDetection[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('fire_detections')
    .select(
      'id, latitude, longitude, acquired_at_utc, source_product, satellite, confidence_normalized, frp_mw, department_id',
    )
    .match(NATIONAL_FILTER)
    .order('acquired_at_utc', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`Error cargando detecciones: ${error.message}`)

  const { data: departments } = await supabase
    .from('geo_departments')
    .select('id, name')
    .eq('country_code', 'GT')

  const deptMap = new Map((departments ?? []).map((d) => [d.id as string, d.name as string]))

  return (data ?? [])
    .filter((row) => !excludeDetectionIds.has(row.id as string))
    .map((row) => {
      const sourceProduct = row.source_product as string
      const satellite = (row.satellite as string | null) ?? null
      const departmentId = (row.department_id as string | null) ?? null
      return {
        id: row.id as string,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        acquired_at_utc: row.acquired_at_utc as string,
        source_product: sourceProduct,
        satellite,
        satellite_normalized:
          satellite && satellite.trim() ? satellite.trim() : sourceProduct,
        confidence_normalized: row.confidence_normalized as ClusterDetection['confidence_normalized'],
        frp_mw: row.frp_mw !== null ? Number(row.frp_mw) : null,
        department_id: departmentId,
        department_name: departmentId ? (deptMap.get(departmentId) ?? null) : null,
      }
    })
}

export async function fetchDetectionById(id: string): Promise<ClusterDetection | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('fire_detections')
    .select(
      'id, latitude, longitude, acquired_at_utc, source_product, satellite, confidence_normalized, frp_mw, department_id',
    )
    .eq('id', id)
    .single()

  if (error || !data) return null

  let departmentName: string | null = null
  if (data.department_id) {
    const { data: dept } = await supabase
      .from('geo_departments')
      .select('name')
      .eq('id', data.department_id as string)
      .single()
    departmentName = (dept?.name as string) ?? null
  }

  const sourceProduct = data.source_product as string
  const satellite = (data.satellite as string | null) ?? null
  return {
    id: data.id as string,
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
    acquired_at_utc: data.acquired_at_utc as string,
    source_product: sourceProduct,
    satellite,
    satellite_normalized: satellite && satellite.trim() ? satellite.trim() : sourceProduct,
    confidence_normalized: data.confidence_normalized as ClusterDetection['confidence_normalized'],
    frp_mw: data.frp_mw !== null ? Number(data.frp_mw) : null,
    department_id: (data.department_id as string | null) ?? null,
    department_name: departmentName,
  }
}

export async function fetchExistingEvents(): Promise<ExistingEvent[]> {
  const supabase = getSupabaseAdmin()
  const { data: events, error } = await supabase
    .from('fire_events')
    .select('id, validation_status, created_at, status')
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Error cargando eventos: ${error.message}`)
  if (!events?.length) return []

  const { data: links, error: linkError } = await supabase
    .from('fire_event_detections')
    .select('event_id, detection_id')

  if (linkError) throw new Error(`Error cargando vínculos: ${linkError.message}`)

  const byEvent = new Map<string, string[]>()
  for (const link of links ?? []) {
    const list = byEvent.get(link.event_id as string) ?? []
    list.push(link.detection_id as string)
    byEvent.set(link.event_id as string, list)
  }

  return events.map((e) => ({
    id: e.id as string,
    validation_status: e.validation_status as ExistingEvent['validation_status'],
    created_at: e.created_at as string,
    status: e.status as ExistingEvent['status'],
    detection_ids: (byEvent.get(e.id as string) ?? []).sort(),
  }))
}

export function getConfirmedReservedDetectionIds(events: ExistingEvent[]): Set<string> {
  const reserved = new Set<string>()
  for (const event of events) {
    if (event.validation_status === 'confirmado') {
      for (const id of event.detection_ids) reserved.add(id)
    }
  }
  return reserved
}

export async function fetchNeighborPairs(
  detectionIds: string[],
): Promise<Array<{ id_a: string; id_b: string }>> {
  if (detectionIds.length < 2) return []

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('fire_detection_neighbor_pairs', {
    p_detection_ids: detectionIds,
    p_distance_m: CLUSTER_CONFIG.distanceThresholdM,
    p_hours: CLUSTER_CONFIG.timeThresholdHours,
  })

  if (error) throw new Error(`Error calculando vecinos PostGIS: ${error.message}`)
  return (data ?? []) as Array<{ id_a: string; id_b: string }>
}

export interface ClusterCommitResult {
  events_created: number
  events_updated: number
  events_merged: number
  events_absorbed: number
  detections_linked: number
}

export async function commitClusterBatch(
  plan: import('@/pipeline/stores/fire-event.types').ClusterWritePlanItem[],
): Promise<ClusterCommitResult> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('fire_cluster_apply_batch', {
    p_clusters: plan,
  })

  if (error) {
    throw new Error(`Error transaccional aplicando clusters: ${error.message}`)
  }

  return data as ClusterCommitResult
}

export async function refreshEventTemporalStatus(): Promise<number> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('fire_events_refresh_temporal_status')
  if (error) throw new Error(`Error actualizando estados temporales: ${error.message}`)
  return Number(data ?? 0)
}
