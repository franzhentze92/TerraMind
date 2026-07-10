import type {
  FireEventListItemDto,
  FireGeometryMethod,
  FireRiskLevel,
  FireValidationStatus,
} from '@/modules/fires/types/fire.dto'

interface RawEventRow {
  id: string
  status: string
  validation_status: string
  risk_level: string
  priority_score: number | string
  centroid_lat: number | string | null
  centroid_lng: number | string | null
  first_detected_at: string
  last_detected_at: string
  persistence_hours: number | string | null
  detection_count: number
  satellite_count: number
  source_products: string[] | null
  max_frp_mw: number | string | null
  geometry_method: string | null
  created_at: string
  metadata?: Record<string, unknown> | null
  geo_departments?: { code: string; name: string } | { code: string; name: string }[] | null
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function readDepartment(
  row: RawEventRow,
): { code: string | null; name: string | null } {
  const dept = row.geo_departments
  if (!dept) return { code: null, name: null }
  const item = Array.isArray(dept) ? dept[0] : dept
  return item ? { code: item.code, name: item.name } : { code: null, name: null }
}

function readCrossDepartment(metadata: Record<string, unknown> | null | undefined): boolean {
  return metadata?.cross_department === true
}

export function mapEventRowToDto(row: RawEventRow): FireEventListItemDto {
  const dept = readDepartment(row)
  return {
    id: row.id,
    department_code: dept.code,
    department_name: dept.name,
    status: row.status as FireEventListItemDto['status'],
    validation_status: row.validation_status as FireValidationStatus,
    risk_level: row.risk_level as FireRiskLevel,
    priority_score: toNumber(row.priority_score) ?? 0,
    centroid_lat: toNumber(row.centroid_lat),
    centroid_lng: toNumber(row.centroid_lng),
    first_detected_at: row.first_detected_at,
    last_detected_at: row.last_detected_at,
    persistence_hours: toNumber(row.persistence_hours),
    detection_count: row.detection_count,
    satellite_count: row.satellite_count,
    source_products: row.source_products ?? [],
    max_frp_mw: toNumber(row.max_frp_mw),
    geometry_method: (row.geometry_method as FireGeometryMethod | null) ?? null,
    cross_department: readCrossDepartment(row.metadata),
    created_at: row.created_at,
  }
}

export function stripSensitiveFields<T extends Record<string, unknown>>(row: T): T {
  const copy = { ...row }
  for (const key of [
    'raw_payload',
    'metadata',
    'event_geometry',
    'centroid',
    'dedup_key',
    'ingestion_run_id',
    'sanitized_request',
    'estimated_area_ha',
    'geo_departments',
  ]) {
    delete copy[key]
  }
  return copy
}
