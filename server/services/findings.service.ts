import type { CompositeFinding } from '@/modules/findings/findings.types'
import {
  getCompositeFindingById,
  listCompositeFindings,
  mapFindingRowToDto,
  type CompositeFindingRow,
} from '@/pipeline/stores/composite-findings.store'

export interface FindingListItemDto {
  id: string
  finding_type: string
  entity_type: string
  entity_id: string
  title: string
  summary: string
  status: string
  severity_label: string
  confidence_level: string
  department_name: string | null
  source_domains: string[]
  generated_at: string
}

export interface FindingDetailDto extends CompositeFinding {
  department_name: string | null
}

function toListItem(row: CompositeFindingRow): FindingListItemDto {
  const confidence = row.confidence as { level?: string }
  return {
    id: row.id,
    finding_type: row.finding_type,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    title: row.title,
    summary: row.summary,
    status: row.status,
    severity_label: row.severity_label,
    confidence_level: confidence.level ?? 'insufficient',
    department_name: (row.geographic_context?.department_name as string | null) ?? null,
    source_domains: row.source_domains,
    generated_at: row.generated_at,
  }
}

function toDetail(row: CompositeFindingRow): FindingDetailDto {
  return {
    ...mapFindingRowToDto(row),
    department_name: (row.geographic_context?.department_name as string | null) ?? null,
  }
}

export async function listFindings(filters: {
  status?: string
  finding_type?: string
  entity_type?: string
  entity_id?: string
  department_code?: string
  confidence?: string
  limit?: number
  offset?: number
}): Promise<{ items: FindingListItemDto[]; generated_at: string }> {
  const rows = await listCompositeFindings(filters)
  let items = rows.map(toListItem)
  if (filters.confidence) {
    items = items.filter((i) => i.confidence_level === filters.confidence)
  }
  return { items, generated_at: new Date().toISOString() }
}

export async function getFindingDetail(id: string): Promise<FindingDetailDto | null> {
  const row = await getCompositeFindingById(id)
  if (!row) return null
  return toDetail(row)
}

export async function getFindingsForFireEvent(
  eventId: string,
): Promise<{ items: FindingDetailDto[]; generated_at: string }> {
  const rows = await listCompositeFindings({
    entity_type: 'fire_event',
    entity_id: eventId,
    limit: 50,
  })
  return {
    items: rows.filter((r) => r.status === 'active' || r.status === 'monitoring').map(toDetail),
    generated_at: new Date().toISOString(),
  }
}
