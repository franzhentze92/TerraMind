import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export interface GeographyClassifyMetrics {
  evaluated: number
  forced: boolean
  reprocessed: number
  inside_guatemala: number
  outside_guatemala: number
  departments_assigned: number
  no_department_match: number
  multiple_department_matches: number
  boundary_matches: number
  unresolved: number
  errors: number
  duration_ms: number
}

export interface GeographyDiagnosticRow {
  latitude: number
  longitude: number
  source_product: string
  acquired_at_utc: string
  is_inside_guatemala: boolean | null
  department: string | null
  geography_method: string
  geography_confidence: string | null
  warning: string | null
}

export interface GeocodeOptions {
  limit?: number
  force?: boolean
}

export async function runFireGeographyClassification(
  options: GeocodeOptions = {},
): Promise<GeographyClassifyMetrics> {
  const limit = options.limit ?? 10000
  const force = options.force ?? false

  if (force) {
    console.warn('⚠️  Reclasificación forzada (p_force=true)')
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('classify_fire_detections_geography', {
    p_limit: limit,
    p_force: force,
  })

  if (error) {
    throw new Error(`Clasificación geográfica falló: ${error.message}`)
  }

  return data as GeographyClassifyMetrics
}

export async function fetchGeographyDiagnostics(): Promise<GeographyDiagnosticRow[]> {
  const supabase = getSupabaseAdmin()

  const { data: detections, error } = await supabase
    .from('fire_detections')
    .select(
      'latitude, longitude, source_product, acquired_at_utc, is_inside_guatemala, geography_method, geography_confidence, department_id',
    )
    .order('acquired_at_utc', { ascending: false })

  if (error) throw new Error(error.message)

  const { data: departments } = await supabase
    .from('geo_departments')
    .select('id, name')
    .eq('country_code', 'GT')

  const deptMap = new Map((departments ?? []).map((d) => [d.id as string, d.name as string]))

  return (detections ?? []).map((row) => {
    let warning: string | null = null
    if (row.is_inside_guatemala === null) {
      warning = 'sin clasificar'
    } else if (row.is_inside_guatemala && !row.department_id) {
      warning = 'dentro sin departamento'
    } else if (row.is_inside_guatemala === false) {
      warning = 'fuera de Guatemala'
    }

    return {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      source_product: row.source_product as string,
      acquired_at_utc: row.acquired_at_utc as string,
      is_inside_guatemala: row.is_inside_guatemala as boolean | null,
      department: row.department_id
        ? (deptMap.get(row.department_id as string) ?? '?')
        : null,
      geography_method: row.geography_method as string,
      geography_confidence: row.geography_confidence as string | null,
      warning,
    }
  })
}

export async function runVerificationQueries(): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin()

  const { count: deptCount } = await supabase
    .from('geo_departments')
    .select('*', { count: 'exact', head: true })

  const { data: allDetections } = await supabase
    .from('fire_detections')
    .select('is_inside_guatemala, geography_method, geography_confidence, department_id')

  const total = allDetections?.length ?? 0
  const inside = allDetections?.filter((r) => r.is_inside_guatemala === true).length ?? 0
  const outside = allDetections?.filter((r) => r.is_inside_guatemala === false).length ?? 0
  const unresolved = allDetections?.filter((r) => r.is_inside_guatemala === null).length ?? 0

  const methodGroups: Record<string, number> = {}
  for (const r of allDetections ?? []) {
    const key = `${r.geography_method ?? 'null'}|${r.geography_confidence ?? 'null'}`
    methodGroups[key] = (methodGroups[key] ?? 0) + 1
  }

  const { data: deptDist } = await supabase
    .from('geo_departments')
    .select('id, name')
    .eq('country_code', 'GT')

  const deptCounts: Array<{ name: string; detections: number }> = []
  for (const dept of deptDist ?? []) {
    const count =
      allDetections?.filter((d) => d.department_id === dept.id).length ?? 0
    deptCounts.push({ name: dept.name as string, detections: count })
  }
  deptCounts.sort((a, b) => b.detections - a.detections || a.name.localeCompare(b.name))

  return {
    geo_departments_count: deptCount,
    fire_detections_summary: { total, inside, outside, unresolved },
    geography_method_distribution: methodGroups,
    department_distribution: deptCounts,
  }
}
