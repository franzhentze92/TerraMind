import type { CompositeFinding, FindingEvaluationResult } from '@/modules/findings/findings.types'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export interface CompositeFindingRow {
  id: string
  finding_type: string
  entity_type: string
  entity_id: string
  title: string
  summary: string
  status: string
  severity_label: string
  confidence: Record<string, unknown>
  evidence: unknown[]
  triggered_rules: string[]
  source_domains: string[]
  geographic_context: Record<string, unknown>
  temporal_context: Record<string, unknown>
  limitations: string[]
  recommended_actions: string[]
  context_version: string
  rule_set_version: string
  generated_at: string
  created_at: string
  updated_at: string
}

export async function listActiveFindingsForEntity(
  entityType: string,
  entityId: string,
  ruleSetVersion: string,
): Promise<CompositeFindingRow[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('composite_findings')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('rule_set_version', ruleSetVersion)
    .in('status', ['active', 'monitoring'])

  if (error) throw new Error(error.message)
  return (data as CompositeFindingRow[]) ?? []
}

export async function persistFindingEvaluation(
  evaluation: FindingEvaluationResult,
): Promise<{
  findings_created: number
  findings_updated: number
  findings_resolved: number
}> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  let findings_created = 0
  let findings_updated = 0
  let findings_resolved = 0

  const existing = await listActiveFindingsForEntity(
    evaluation.entity_type,
    evaluation.entity_id,
    evaluation.rule_set_version,
  )
  const existingByType = new Map(existing.map((f) => [f.finding_type, f]))
  const newTypes = new Set(evaluation.findings.map((f) => f.finding_type))

  for (const finding of evaluation.findings) {
    const prev = existingByType.get(finding.finding_type)
    const row = {
      finding_type: finding.finding_type,
      entity_type: finding.entity_type,
      entity_id: finding.entity_id,
      title: finding.title,
      summary: finding.summary,
      status: finding.status,
      severity_label: finding.severity_label,
      confidence: finding.confidence,
      evidence: finding.evidence,
      triggered_rules: finding.triggered_rules,
      source_domains: finding.source_domains,
      geographic_context: finding.geographic_context,
      temporal_context: finding.temporal_context,
      limitations: finding.limitations,
      recommended_actions: finding.recommended_actions,
      context_version: finding.context_version,
      rule_set_version: finding.rule_set_version,
      generated_at: finding.generated_at,
      updated_at: now,
    }

    if (prev) {
      const { error } = await supabase
        .from('composite_findings')
        .update(row)
        .eq('id', prev.id)
      if (error) throw new Error(error.message)
      findings_updated += 1
    } else {
      const { error } = await supabase.from('composite_findings').insert(row)
      if (error) throw new Error(error.message)
      findings_created += 1
    }
  }

  for (const prev of existing) {
    if (!newTypes.has(prev.finding_type)) {
      const { error } = await supabase
        .from('composite_findings')
        .update({ status: 'resolved', updated_at: now })
        .eq('id', prev.id)
      if (error) throw new Error(error.message)
      findings_resolved += 1
    }
  }

  const { error: runError } = await supabase.from('finding_evaluation_runs').insert({
    entity_type: evaluation.entity_type,
    entity_id: evaluation.entity_id,
    rule_set_version: evaluation.rule_set_version,
    context_version: evaluation.context_version,
    contexts_available: evaluation.contexts_available,
    rules_evaluated: evaluation.rule_results.length,
    findings_created,
    findings_updated,
    findings_resolved,
    warnings: evaluation.warnings,
    started_at: new Date(Date.now() - evaluation.duration_ms).toISOString(),
    completed_at: now,
  })
  if (runError) throw new Error(runError.message)

  return { findings_created, findings_updated, findings_resolved }
}

export async function listCompositeFindings(filters: {
  status?: string
  finding_type?: string
  entity_type?: string
  entity_id?: string
  department_code?: string
  limit?: number
  offset?: number
}): Promise<CompositeFindingRow[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('composite_findings')
    .select('*')
    .order('generated_at', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.finding_type) query = query.eq('finding_type', filters.finding_type)
  if (filters.entity_type) query = query.eq('entity_type', filters.entity_type)
  if (filters.entity_id) query = query.eq('entity_id', filters.entity_id)

  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  let rows = (data as CompositeFindingRow[]) ?? []
  if (filters.department_code) {
    rows = rows.filter(
      (r) => r.geographic_context?.department_code === filters.department_code,
    )
  }
  return rows
}

export async function getCompositeFindingById(id: string): Promise<CompositeFindingRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('composite_findings')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as CompositeFindingRow | null) ?? null
}

export function mapFindingRowToDto(row: CompositeFindingRow): CompositeFinding {
  return {
    id: row.id,
    finding_type: row.finding_type,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    title: row.title,
    summary: row.summary,
    status: row.status as CompositeFinding['status'],
    severity_label: row.severity_label as CompositeFinding['severity_label'],
    confidence: row.confidence as unknown as CompositeFinding['confidence'],
    evidence: row.evidence as CompositeFinding['evidence'],
    triggered_rules: row.triggered_rules,
    source_domains: row.source_domains as CompositeFinding['source_domains'],
    geographic_context: row.geographic_context,
    temporal_context: row.temporal_context,
    limitations: row.limitations,
    recommended_actions: row.recommended_actions,
    generated_at: row.generated_at,
    context_version: row.context_version,
    rule_set_version: row.rule_set_version,
  }
}
