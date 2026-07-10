import type { BiodiversityContextQuality } from '@/modules/biodiversity/services/biodiversity-context-quality'
import type { BiodiversityVisualHighlight } from '@/modules/biodiversity/services/biodiversity-event-query.service'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export type BiodiversityContextStatus = 'complete' | 'partial' | 'unavailable' | 'error' | 'stale'

export interface BiodiversityContextRow {
  id: string
  entity_type: string
  entity_id: string
  context_version: string
  status: BiodiversityContextStatus
  geometry_source: string | null
  event_time: string | null
  history_start: string | null
  history_end: string | null
  provider_status: Record<string, unknown>
  summary: Record<string, unknown>
  quality: BiodiversityContextQuality | Record<string, unknown>
  monitored_zone_context: Record<string, unknown>
  warnings: string[]
  generated_at: string
  created_at: string
  updated_at: string
}

export interface BiodiversityZoneRow {
  id: string
  context_id: string
  radius_m: number
  unique_species_documented: number
  observations_documented: number
  observations_recent_30d: number
  observations_recent_90d: number
  event_window_observations: number
  gbif_count: number
  inaturalist_count: number
  research_grade_inaturalist: number
  generalized_count: number
  obscured_count: number
  spatially_excluded_count: number
  duplicated_count: number
  media_usable_count: number
  latest_observation_at: string | null
  taxa_distribution: Record<string, number>
  data_quality: Record<string, unknown>
  truncated: boolean
  warnings: string[]
  generated_at: string
}

export interface BiodiversityVisualHighlightRow {
  id: string
  context_id: string
  sort_order: number
  source: string
  source_occurrence_id: string
  taxon_name: string
  common_name: string | null
  taxonomic_group: string
  thumbnail_url: string | null
  image_url: string | null
  image_license: string | null
  image_attribution: string | null
  observation_url: string | null
  observed_at: string | null
  privacy_status: string
}

export interface BiodiversityEventCandidate {
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

export interface PersistBiodiversityContextInput {
  entityType: string
  entityId: string
  contextVersion: string
  status: BiodiversityContextStatus
  geometrySource: string
  eventTime: string | null
  historyStart: string
  historyEnd: string
  providerStatus: Record<string, unknown>
  summary: Record<string, unknown>
  quality: BiodiversityContextQuality
  monitoredZoneContext: Record<string, unknown>
  warnings: string[]
  generatedAt: string
  zones: Array<{
    radius_m: number
    unique_species_documented: number
    observations_documented: number
    observations_recent_30d: number
    observations_recent_90d: number
    event_window_observations: number
    gbif_count: number
    inaturalist_count: number
    research_grade_inaturalist: number
    generalized_count: number
    obscured_count: number
    spatially_excluded_count: number
    duplicated_count: number
    media_usable_count: number
    latest_observation_at: string | null
    taxa_distribution: Record<string, number>
    truncated: boolean
    warnings: string[]
    generatedAt: string
  }>
  visualHighlights: BiodiversityVisualHighlight[]
}

async function getLatestBiodiversityContextsForEvents(
  eventIds: string[],
): Promise<Map<string, { context_version: string; generated_at: string }>> {
  const map = new Map<string, { context_version: string; generated_at: string }>()
  if (!eventIds.length) return map

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('entity_biodiversity_context')
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

export async function fetchBiodiversityEventDetections(
  eventId: string,
): Promise<Array<{ id: string; latitude: number; longitude: number }>> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('fire_event_detections')
    .select('fire_detections (id, latitude, longitude)')
    .eq('event_id', eventId)

  if (error) throw new Error(error.message)

  return (data ?? [])
    .map((link) => {
      const raw = link.fire_detections as Record<string, unknown> | Record<string, unknown>[] | null
      const det = Array.isArray(raw) ? raw[0] : raw
      if (!det) return null
      const lat = Number(det.latitude)
      const lng = Number(det.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return { id: String(det.id), latitude: lat, longitude: lng }
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)
}

export async function listBiodiversityEventCandidates(
  limit = 10000,
): Promise<BiodiversityEventCandidate[]> {
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
  const eventIds = (data ?? []).map((r) => String(r.id))
  const contexts = await getLatestBiodiversityContextsForEvents(eventIds)

  return (data ?? []).map((row) => {
    const deptRaw = row.geo_departments as { code?: string; name?: string } | { code?: string; name?: string }[] | null
    const dept = Array.isArray(deptRaw) ? deptRaw[0] : deptRaw
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
      department_code: dept?.code ?? null,
      department_name: dept?.name ?? null,
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

export async function getLatestBiodiversityContext(
  eventId: string,
): Promise<BiodiversityContextRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('entity_biodiversity_context')
    .select('*')
    .eq('entity_type', 'fire_event')
    .eq('entity_id', eventId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as BiodiversityContextRow | null) ?? null
}

export async function getBiodiversityZones(contextId: string): Promise<BiodiversityZoneRow[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('entity_biodiversity_zones')
    .select('*')
    .eq('context_id', contextId)
    .order('radius_m', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as BiodiversityZoneRow[]) ?? []
}

export async function getBiodiversityVisualHighlights(
  contextId: string,
): Promise<BiodiversityVisualHighlightRow[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('entity_biodiversity_visual_highlights')
    .select('*')
    .eq('context_id', contextId)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as BiodiversityVisualHighlightRow[]) ?? []
}

export async function persistBiodiversityContext(input: PersistBiodiversityContextInput): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  const { data: ctxRow, error: ctxError } = await supabase
    .from('entity_biodiversity_context')
    .upsert(
      {
        entity_type: input.entityType,
        entity_id: input.entityId,
        context_version: input.contextVersion,
        status: input.status,
        geometry_source: input.geometrySource,
        event_time: input.eventTime,
        history_start: input.historyStart,
        history_end: input.historyEnd,
        provider_status: input.providerStatus,
        summary: input.summary,
        quality: input.quality,
        monitored_zone_context: input.monitoredZoneContext,
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

  await supabase.from('entity_biodiversity_zones').delete().eq('context_id', contextId)
  await supabase.from('entity_biodiversity_visual_highlights').delete().eq('context_id', contextId)

  if (input.zones.length) {
    const { error: zoneError } = await supabase.from('entity_biodiversity_zones').insert(
      input.zones.map((z) => ({
        context_id: contextId,
        radius_m: z.radius_m,
        unique_species_documented: z.unique_species_documented,
        observations_documented: z.observations_documented,
        observations_recent_30d: z.observations_recent_30d,
        observations_recent_90d: z.observations_recent_90d,
        event_window_observations: z.event_window_observations,
        gbif_count: z.gbif_count,
        inaturalist_count: z.inaturalist_count,
        research_grade_inaturalist: z.research_grade_inaturalist,
        generalized_count: z.generalized_count,
        obscured_count: z.obscured_count,
        spatially_excluded_count: z.spatially_excluded_count,
        duplicated_count: z.duplicated_count,
        media_usable_count: z.media_usable_count,
        latest_observation_at: z.latest_observation_at,
        taxa_distribution: z.taxa_distribution,
        data_quality: {},
        truncated: z.truncated,
        warnings: z.warnings,
        generated_at: z.generatedAt,
      })),
    )
    if (zoneError) throw new Error(zoneError.message)
  }

  if (input.visualHighlights.length) {
    const { error: visualError } = await supabase.from('entity_biodiversity_visual_highlights').insert(
      input.visualHighlights.map((v) => ({
        context_id: contextId,
        sort_order: v.sort_order,
        source: v.source,
        source_occurrence_id: v.source_occurrence_id,
        taxon_name: v.taxon_name,
        common_name: v.common_name,
        taxonomic_group: v.taxonomic_group,
        thumbnail_url: v.thumbnail_url,
        image_url: v.image_url,
        image_license: v.image_license,
        image_attribution: v.image_attribution,
        observation_url: v.observation_url,
        observed_at: v.observed_at,
        privacy_status: v.privacy_status,
      })),
    )
    if (visualError) throw new Error(visualError.message)
  }
}
