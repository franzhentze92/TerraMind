import type { FireEventsQuery } from '@/modules/fires/api/fire-api.validation'
import { mapEventRowToDto } from '@/modules/fires/api/fire-api.mappers'
import type { FireEventsListDto } from '@/modules/fires/types/fire.dto'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import { applyEventFilters, resolveDepartmentId } from './fire-query.builder.js'

const EVENT_SELECT = `
  id,
  status,
  validation_status,
  risk_level,
  priority_score,
  centroid_lat,
  centroid_lng,
  first_detected_at,
  last_detected_at,
  persistence_hours,
  detection_count,
  satellite_count,
  source_products,
  max_frp_mw,
  geometry_method,
  created_at,
  department_id,
  metadata,
  geo_departments!fire_events_department_id_fkey (code, name)
`

export async function listFireEvents(query: FireEventsQuery): Promise<FireEventsListDto> {
  const supabase = getSupabaseAdmin()
  const generatedAt = new Date().toISOString()

  const { departmentId, notFound } = await resolveDepartmentId(
    supabase,
    query.department_code,
  )

  if (notFound) {
    return {
      items: [],
      pagination: { limit: query.limit, offset: query.offset, total: 0 },
      filters: buildFiltersDto(query),
      generated_at: generatedAt,
    }
  }

  let builder = supabase.from('fire_events').select(EVENT_SELECT, { count: 'exact' })
  builder = applyEventFilters(builder, query, departmentId)

  const { data, error, count } = await builder
    .order('priority_score', { ascending: false })
    .order('last_detected_at', { ascending: false })
    .order('id', { ascending: true })
    .range(query.offset, query.offset + query.limit - 1)

  if (error) throw new Error(error.message)

  return {
    items: (data ?? []).map(mapEventRowToDto),
    pagination: {
      limit: query.limit,
      offset: query.offset,
      total: count ?? 0,
    },
    filters: buildFiltersDto(query),
    generated_at: generatedAt,
  }
}

function buildFiltersDto(query: FireEventsQuery) {
  const filters: FireEventsListDto['filters'] = {}
  if (query.since) filters.since = query.since
  if (query.until) filters.until = query.until
  if (query.department_code) filters.department_code = query.department_code
  if (query.risk_level) filters.risk_level = query.risk_level
  if (query.status) filters.status = query.status
  if (query.validation_status) filters.validation_status = query.validation_status
  if (query.source_product) filters.source_product = query.source_product
  if (query.min_priority !== undefined) filters.min_priority = query.min_priority
  return filters
}
