import type { FireEventsQuery } from '@/modules/fires/api/fire-api.validation'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface DepartmentLookup {
  departmentId: string | null
  notFound: boolean
}

export async function resolveDepartmentId(
  supabase: SupabaseClient,
  departmentCode?: string,
): Promise<DepartmentLookup> {
  if (!departmentCode) return { departmentId: null, notFound: false }

  const { data, error } = await supabase
    .from('geo_departments')
    .select('id')
    .eq('code', departmentCode)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return { departmentId: null, notFound: true }
  return { departmentId: data.id, notFound: false }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyEventFilters<T extends { eq: any; gte: any; lte: any; contains: any }>(
  builder: T,
  query: FireEventsQuery,
  departmentId: string | null,
): T {
  let next = builder
  if (query.since) next = next.gte('last_detected_at', query.since)
  if (query.until) next = next.lte('last_detected_at', query.until)
  if (departmentId) next = next.eq('department_id', departmentId)
  if (query.risk_level) next = next.eq('risk_level', query.risk_level)
  if (query.status) next = next.eq('status', query.status)
  if (query.validation_status) next = next.eq('validation_status', query.validation_status)
  if (query.source_product) next = next.contains('source_products', [query.source_product])
  if (query.min_priority !== undefined) next = next.gte('priority_score', query.min_priority)
  return next
}
