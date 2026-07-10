import type { PriorityAssessment } from '@/modules/priorities/priorities.types'
import {
  getPriorityAssessmentById,
  listPriorityAssessmentHistory,
  listPriorityAssessments,
  mapPriorityRowToAssessment,
  type PriorityAssessmentRow,
} from '@/pipeline/stores/priority-assessments.store'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export interface PriorityListItemDto {
  id: string
  entity_type: string
  entity_id: string
  department_name: string | null
  attention_score: number
  verification_score: number
  action_score: number
  attention_level: string
  verification_level: string
  action_level: string
  priority_reasons: string[]
  priority_limitations: string[]
  recommended_next_step: string
  dominant_domains: string[]
  evaluated_at: string
  valid_until: string
  assessment_status: string
}

export interface PriorityDetailDto extends PriorityAssessment {
  department_name: string | null
  department_code: string | null
  history: Array<{
    id: string
    attention_score: number
    attention_level: string
    evaluated_at: string
    assessment_status: string
  }>
}

async function loadEventDepartments(
  entityIds: string[],
): Promise<Map<string, { name: string | null; code: string | null }>> {
  if (!entityIds.length) return new Map()
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('fire_events')
    .select('id, geo_departments!fire_events_department_id_fkey (code, name)')
    .in('id', entityIds)
  if (error) throw new Error(error.message)

  const map = new Map<string, { name: string | null; code: string | null }>()
  for (const row of data ?? []) {
    const deptRaw = row.geo_departments as { code?: string; name?: string } | { code?: string; name?: string }[] | null
    const dept = Array.isArray(deptRaw) ? deptRaw[0] : deptRaw
    map.set(String(row.id), { name: dept?.name ?? null, code: dept?.code ?? null })
  }
  return map
}

function dominantDomains(row: PriorityAssessmentRow): string[] {
  const entries = Object.entries(row.domain_contributions ?? {})
  return entries
    .filter(([, v]) => Number(v) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 3)
    .map(([k]) => k)
}

function toListItem(
  row: PriorityAssessmentRow,
  dept?: { name: string | null; code: string | null },
): PriorityListItemDto {
  return {
    id: row.id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    department_name: dept?.name ?? null,
    attention_score: Number(row.attention_score),
    verification_score: Number(row.verification_score),
    action_score: Number(row.action_score),
    attention_level: row.attention_level,
    verification_level: row.verification_level,
    action_level: row.action_level,
    priority_reasons: row.priority_reasons,
    priority_limitations: row.priority_limitations.slice(0, 2),
    recommended_next_step: row.recommended_next_step,
    dominant_domains: dominantDomains(row),
    evaluated_at: row.evaluated_at,
    valid_until: row.valid_until,
    assessment_status: row.assessment_status,
  }
}

export async function listPriorities(filters: {
  attention_level?: string
  verification_level?: string
  action_level?: string
  department_code?: string
  dominant_domain?: string
  limit?: number
  offset?: number
}): Promise<{ items: PriorityListItemDto[]; generated_at: string }> {
  const rows = await listPriorityAssessments({
    assessment_status: 'active',
    attention_level: filters.attention_level,
    verification_level: filters.verification_level,
    action_level: filters.action_level,
    entity_type: 'fire_event',
    limit: filters.limit,
    offset: filters.offset,
  })

  const entityIds = rows.map((r) => r.entity_id)
  const deptMap = await loadEventDepartments(entityIds)

  let items = rows.map((row) => toListItem(row, deptMap.get(row.entity_id)))

  if (filters.department_code) {
    items = items.filter((item) => {
      const dept = deptMap.get(item.entity_id)
      return dept?.code === filters.department_code
    })
  }

  if (filters.dominant_domain) {
    items = items.filter((item) => item.dominant_domains.includes(filters.dominant_domain!))
  }

  return { items, generated_at: new Date().toISOString() }
}

export async function getPriorityDetail(id: string): Promise<PriorityDetailDto | null> {
  const row = await getPriorityAssessmentById(id)
  if (!row) return null

  const deptMap = await loadEventDepartments([row.entity_id])
  const dept = deptMap.get(row.entity_id)
  const history = await listPriorityAssessmentHistory(row.entity_type, row.entity_id, 10)

  return {
    ...mapPriorityRowToAssessment(row),
    department_name: dept?.name ?? null,
    department_code: dept?.code ?? null,
    history: history.map((h) => ({
      id: h.id,
      attention_score: Number(h.attention_score),
      attention_level: h.attention_level,
      evaluated_at: h.evaluated_at,
      assessment_status: h.assessment_status,
    })),
  }
}

export async function getPriorityForFireEvent(
  eventId: string,
): Promise<{ assessment: PriorityDetailDto | null; generated_at: string }> {
  const { getActivePriorityAssessment } = await import(
    '@/pipeline/stores/priority-assessments.store'
  )
  const { resolvePriorityModelVersion } = await import(
    '@/modules/priorities/services/fire-priority-context.loader'
  )
  const row = await getActivePriorityAssessment(
    'fire_event',
    eventId,
    resolvePriorityModelVersion(),
  )
  if (!row) return { assessment: null, generated_at: new Date().toISOString() }
  const detail = await getPriorityDetail(row.id)
  return { assessment: detail, generated_at: new Date().toISOString() }
}
