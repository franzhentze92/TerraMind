import type { FireEventsQuery } from '@/modules/fires/api/fire-api.validation'
import { mapEventRowToDto } from '@/modules/fires/api/fire-api.mappers'
import { sourceProductDisplayName } from '@/modules/fires/utils/source-labels'
import type {
  FireEventsGeoJsonDto,
  FireEventGeoJsonFeature,
  FireDetectionsGeoJsonDto,
} from '@/modules/fires/types/fire.dto'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import { applyEventFilters, resolveDepartmentId } from './fire-query.builder.js'

const EVENT_GEO_SELECT = `
  id,
  status,
  validation_status,
  risk_level,
  priority_score,
  last_detected_at,
  detection_count,
  satellite_count,
  geometry_method,
  event_geometry,
  department_id,
  metadata,
  geo_departments!fire_events_department_id_fkey (code, name)
`

interface RawGeoRow {
  id: string
  status: string
  validation_status: string
  risk_level: string
  priority_score: number | string
  last_detected_at: string
  detection_count: number
  satellite_count: number
  geometry_method: string | null
  event_geometry: GeoJSON.Geometry | null
  metadata?: Record<string, unknown> | null
  geo_departments?: { code: string; name: string } | { code: string; name: string }[] | null
}

function readDepartment(row: RawGeoRow): { code: string | null; name: string | null } {
  const dept = row.geo_departments
  if (!dept) return { code: null, name: null }
  const item = Array.isArray(dept) ? dept[0] : dept
  return item ? { code: item.code, name: item.name } : { code: null, name: null }
}

function toFeature(row: RawGeoRow): FireEventGeoJsonFeature | null {
  if (!row.event_geometry) return null
  const dept = readDepartment(row)
  const dto = mapEventRowToDto(row)

  return {
    type: 'Feature',
    id: row.id,
    geometry: row.event_geometry,
    properties: {
      event_id: row.id,
      department_code: dept.code,
      department_name: dept.name,
      status: row.status,
      validation_status: row.validation_status,
      risk_level: row.risk_level,
      priority_score: dto.priority_score,
      detection_count: row.detection_count,
      satellite_count: row.satellite_count,
      last_detected_at: row.last_detected_at,
      geometry_method: row.geometry_method,
      geometry_is_diagnostic: true,
    },
  }
}

export async function getFireEventsGeoJson(
  query: FireEventsQuery,
): Promise<FireEventsGeoJsonDto> {
  const supabase = getSupabaseAdmin()
  const generatedAt = new Date().toISOString()
  const { departmentId, notFound } = await resolveDepartmentId(
    supabase,
    query.department_code,
  )

  if (notFound) {
    return { type: 'FeatureCollection', features: [], generated_at: generatedAt }
  }

  let builder = supabase.from('fire_events').select(EVENT_GEO_SELECT)
  builder = applyEventFilters(builder, query, departmentId)

  const { data, error } = await builder
    .order('priority_score', { ascending: false })
    .order('last_detected_at', { ascending: false })
    .limit(query.limit ?? 100)

  if (error) throw new Error(error.message)

  const features = ((data ?? []) as RawGeoRow[])
    .map(toFeature)
    .filter((f): f is FireEventGeoJsonFeature => f !== null)

  return {
    type: 'FeatureCollection',
    features,
    generated_at: generatedAt,
  }
}

export async function getFireDetectionsGeoJson(
  query: FireEventsQuery,
): Promise<FireDetectionsGeoJsonDto> {
  const supabase = getSupabaseAdmin()
  const generatedAt = new Date().toISOString()
  const { departmentId, notFound } = await resolveDepartmentId(
    supabase,
    query.department_code,
  )

  if (notFound) {
    return { type: 'FeatureCollection', features: [], generated_at: generatedAt }
  }

  let eventBuilder = supabase.from('fire_events').select('id')
  eventBuilder = applyEventFilters(eventBuilder, query, departmentId)

  const { data: events, error: eventsError } = await eventBuilder.limit(100)
  if (eventsError) throw new Error(eventsError.message)

  const eventIds = (events ?? []).map((e) => e.id as string)
  if (eventIds.length === 0) {
    return { type: 'FeatureCollection', features: [], generated_at: generatedAt }
  }

  const { data: links, error: linksError } = await supabase
    .from('fire_event_detections')
    .select(
      `
      event_id,
      fire_detections (
        id,
        latitude,
        longitude,
        acquired_at_utc,
        source_product,
        satellite,
        confidence_normalized,
        frp_mw,
        daynight
      )
    `,
    )
    .in('event_id', eventIds)

  if (linksError) throw new Error(linksError.message)

  const features = (links ?? [])
    .map((link) => {
      const raw = link.fire_detections as Record<string, unknown> | Record<string, unknown>[] | null
      const det = Array.isArray(raw) ? raw[0] : raw
      if (!det) return null

      const lat = Number(det.latitude)
      const lng = Number(det.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

      const source = String(det.source_product)

      return {
        type: 'Feature' as const,
        id: String(det.id),
        geometry: {
          type: 'Point' as const,
          coordinates: [lng, lat],
        },
        properties: {
          detection_id: String(det.id),
          event_id: String(link.event_id),
          acquired_at_utc: String(det.acquired_at_utc),
          source_product: source,
          source_display_name: sourceProductDisplayName(source),
          satellite: (det.satellite as string | null) ?? null,
          confidence_normalized:
            (det.confidence_normalized as 'baja' | 'media' | 'alta' | null) ?? null,
          frp_mw: det.frp_mw != null ? Number(det.frp_mw) : null,
          daynight: (det.daynight as string | null) ?? null,
        },
      }
    })
    .filter((f): f is NonNullable<typeof f> => f !== null)

  return {
    type: 'FeatureCollection',
    features,
    generated_at: generatedAt,
  }
}
