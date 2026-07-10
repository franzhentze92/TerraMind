import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export interface TerritorialLayerRow {
  id: string
  layer_code: string
  source_version: string
  source_date: string | null
  metadata: Record<string, unknown>
}

export interface UpsertTerritorialFeatureInput {
  layerCode: string
  sourceFeatureId: string
  logicalAreaKey: string
  name: string
  featureType: string | null
  properties: Record<string, unknown>
  geometry: GeoJSON.Geometry
}

export async function getTerritorialLayer(layerCode: string): Promise<TerritorialLayerRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('territorial_layers')
    .select('id, layer_code, source_version, source_date, metadata')
    .eq('layer_code', layerCode)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as TerritorialLayerRow | null
}

export async function upsertTerritorialFeature(input: UpsertTerritorialFeatureInput): Promise<string> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('territorial_upsert_feature', {
    p_layer_code: input.layerCode,
    p_source_feature_id: input.sourceFeatureId,
    p_logical_area_key: input.logicalAreaKey,
    p_name: input.name,
    p_feature_type: input.featureType,
    p_properties: input.properties,
    p_geometry_geojson: input.geometry,
  })

  if (error) throw new Error(error.message)
  return String(data)
}

export async function countTerritorialFeatures(layerCode: string): Promise<number> {
  const layer = await getTerritorialLayer(layerCode)
  if (!layer) return 0

  const supabase = getSupabaseAdmin()
  const { count, error } = await supabase
    .from('territorial_features')
    .select('id', { count: 'exact', head: true })
    .eq('layer_id', layer.id)

  if (error) throw new Error(error.message)
  return count ?? 0
}

export interface FireEventContextRow {
  event_id: string
  context_version: string
  inside_protected_area: boolean | null
  detections_inside_protected_area_count: number
  detection_ids_inside_protected_area: string[]
  protected_area_ids: string[]
  protected_area_names: string[]
  diagnostic_geometry_intersects_protected_area: boolean | null
  nearest_protected_area_id: string | null
  nearest_protected_area_name: string | null
  nearest_protected_area_distance_m: number | null
  protected_area_context_status: string
  source_versions: Record<string, unknown>
  context_completeness: number | null
  generated_at: string
}

export async function enrichEventProtectedAreaContext(
  eventId: string,
  contextVersion: string,
  sourceVersions: Record<string, unknown>,
): Promise<FireEventContextRow> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('fire_enrich_protected_area_context', {
    p_event_id: eventId,
    p_context_version: contextVersion,
    p_source_versions: sourceVersions,
  })

  if (error) throw new Error(error.message)
  return data as FireEventContextRow
}

export async function getFeaturesByIds(ids: string[]): Promise<
  Array<{
    id: string
    name: string | null
    feature_type: string | null
    properties: Record<string, unknown>
  }>
> {
  if (ids.length === 0) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('territorial_features')
    .select('id, name, feature_type, properties')
    .in('id', ids)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string | null,
    feature_type: row.feature_type as string | null,
    properties: (row.properties ?? {}) as Record<string, unknown>,
  }))
}
