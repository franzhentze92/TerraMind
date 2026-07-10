import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import type {
  InternalLandCoverClass,
  LandCoverAnalysis,
  LandCoverWarningCode,
} from '@/modules/territory/land-cover/land-cover.types'

export interface LandCoverContextRow {
  event_id: string
  context_version: string
  source_layer_id: string | null
  source_version: string
  reference_year: number
  point_distribution: Record<string, unknown>
  status: string
  warnings: LandCoverWarningCode[]
  generated_at: string
  updated_at: string
}

export interface LandCoverZoneRow {
  id: string
  event_id: string
  radius_m: number
  context_version: string
  dominant_class: string | null
  class_distribution: Record<string, unknown>
  herbaceous_wetland_pct: number | null
  mangrove_pct: number | null
  forest_pct: number | null
  cropland_pct: number | null
  built_up_pct: number | null
  permanent_water_pct: number | null
  valid_pixel_count: number
  nodata_pixel_count: number
  data_coverage_pct: number | null
  analyzed_area_ha: number | null
  generated_at: string
}

export interface EventDetectionPoint {
  id: string
  latitude: number
  longitude: number
}

export interface LandCoverEventCandidate {
  id: string
  department_name: string | null
  detection_count: number
  centroid_lat: number | null
  centroid_lng: number | null
  last_linked_at: string | null
  context_version: string | null
  context_generated_at: string | null
}

function pctForClass(
  distribution: LandCoverAnalysis['zones'][0]['distribution'],
  internalClass: InternalLandCoverClass,
): number | null {
  const row = distribution.classDistribution.find((r) => r.internalClass === internalClass)
  return row ? Math.round(row.pct * 100) / 100 : null
}

function pointDistributionPayload(analysis: LandCoverAnalysis): Record<string, unknown> {
  return {
    dominant_class: analysis.pointDistribution.dominantClass,
    class_distribution: analysis.pointDistribution.classDistribution.map((row) => ({
      internal_class: row.internalClass,
      provider_class_code: row.providerClassCode,
      count: row.count,
      pct: row.pct,
    })),
    valid_pixel_count: analysis.pointDistribution.validPixelCount,
    nodata_pixel_count: analysis.pointDistribution.nodataPixelCount,
    data_coverage_pct: analysis.pointDistribution.dataCoveragePct,
    samples: analysis.pointSamples.map((s) => ({
      latitude: s.latitude,
      longitude: s.longitude,
      provider_class_code: s.providerClassCode,
      internal_class: s.internalClass,
      nodata: s.nodata,
      outside_coverage: s.outsideCoverage,
    })),
  }
}

function zoneDistributionPayload(
  distribution: LandCoverAnalysis['zones'][0]['distribution'],
): Record<string, unknown> {
  return {
    dominant_class: distribution.dominantClass,
    classes: distribution.classDistribution.map((row) => ({
      internal_class: row.internalClass,
      provider_class_code: row.providerClassCode,
      count: row.count,
      pct: row.pct,
    })),
  }
}

export async function getTerritorialLayerId(layerCode: string): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('territorial_layers')
    .select('id')
    .eq('layer_code', layerCode)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data?.id as string) ?? null
}

export async function listLandCoverEventCandidates(limit: number): Promise<LandCoverEventCandidate[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('fire_events')
    .select(
      `
      id,
      detection_count,
      centroid_lat,
      centroid_lng,
      geo_departments!fire_events_department_id_fkey (name),
      fire_event_land_cover_context (context_version, generated_at),
      fire_event_detections (linked_at)
    `,
    )
    .order('last_detected_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const dept = row.geo_departments as { name?: string } | { name?: string }[] | null
    const department_name = Array.isArray(dept) ? dept[0]?.name ?? null : dept?.name ?? null
    const ctxRaw = row.fire_event_land_cover_context as
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
      centroid_lat: row.centroid_lat != null ? Number(row.centroid_lat) : null,
      centroid_lng: row.centroid_lng != null ? Number(row.centroid_lng) : null,
      last_linked_at: lastLinked,
      context_version: ctx?.context_version ?? null,
      context_generated_at: ctx?.generated_at ?? null,
    }
  })
}

export async function fetchEventDetections(eventId: string): Promise<EventDetectionPoint[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('fire_event_detections')
    .select('detection_id, fire_detections (id, latitude, longitude)')
    .eq('event_id', eventId)

  if (error) throw new Error(error.message)

  const points: EventDetectionPoint[] = []
  for (const link of data ?? []) {
    const raw = link.fire_detections as
      | { id?: string; latitude?: number; longitude?: number }
      | Array<{ id?: string; latitude?: number; longitude?: number }>
      | null
    const det = Array.isArray(raw) ? raw[0] : raw
    if (!det?.id) continue
    points.push({
      id: String(det.id),
      latitude: Number(det.latitude),
      longitude: Number(det.longitude),
    })
  }
  return points
}

export async function getLandCoverContext(eventId: string): Promise<LandCoverContextRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('fire_event_land_cover_context')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as LandCoverContextRow | null) ?? null
}

export async function getLandCoverZones(
  eventId: string,
  contextVersion?: string,
): Promise<LandCoverZoneRow[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('fire_event_land_cover_zones')
    .select('*')
    .eq('event_id', eventId)
    .order('radius_m', { ascending: true })

  if (contextVersion) {
    query = query.eq('context_version', contextVersion)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data as LandCoverZoneRow[]) ?? []
}

export async function persistLandCoverAnalysis(
  eventId: string,
  analysis: LandCoverAnalysis,
  sourceLayerId: string | null,
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  const { error: ctxError } = await supabase.from('fire_event_land_cover_context').upsert(
    {
      event_id: eventId,
      context_version: analysis.contextVersion,
      source_layer_id: sourceLayerId,
      source_version: analysis.sourceVersion,
      reference_year: analysis.sourceYear,
      point_distribution: pointDistributionPayload(analysis),
      status: analysis.status,
      warnings: analysis.warnings,
      generated_at: analysis.generatedAt,
      updated_at: now,
    },
    { onConflict: 'event_id' },
  )
  if (ctxError) throw new Error(ctxError.message)

  const { error: delError } = await supabase
    .from('fire_event_land_cover_zones')
    .delete()
    .eq('event_id', eventId)
    .neq('context_version', analysis.contextVersion)
  if (delError) throw new Error(delError.message)

  if (analysis.zones.length === 0) return

  const zoneRows = analysis.zones.map((zone) => ({
    event_id: eventId,
    radius_m: zone.radiusM,
    context_version: analysis.contextVersion,
    dominant_class: zone.distribution.dominantClass,
    class_distribution: zoneDistributionPayload(zone.distribution),
    herbaceous_wetland_pct: pctForClass(zone.distribution, 'herbaceous_wetland'),
    mangrove_pct: pctForClass(zone.distribution, 'mangrove'),
    forest_pct: pctForClass(zone.distribution, 'forest'),
    cropland_pct: pctForClass(zone.distribution, 'cropland'),
    built_up_pct: pctForClass(zone.distribution, 'built_up'),
    permanent_water_pct: pctForClass(zone.distribution, 'permanent_water'),
    valid_pixel_count: zone.distribution.validPixelCount,
    nodata_pixel_count: zone.distribution.nodataPixelCount,
    data_coverage_pct: zone.distribution.dataCoveragePct,
    analyzed_area_ha: zone.distribution.analyzedAreaHa,
    generated_at: analysis.generatedAt,
  }))

  const { error: zoneError } = await supabase
    .from('fire_event_land_cover_zones')
    .upsert(zoneRows, { onConflict: 'event_id,radius_m,context_version' })
  if (zoneError) throw new Error(zoneError.message)
}

export async function countLandCoverContexts(): Promise<number> {
  const supabase = getSupabaseAdmin()
  const { count, error } = await supabase
    .from('fire_event_land_cover_context')
    .select('event_id', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  return count ?? 0
}
