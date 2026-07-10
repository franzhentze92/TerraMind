import type { PriorityAssessment, PriorityEvaluationResult } from '@/modules/priorities/priorities.types'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export interface PriorityAssessmentRow {
  id: string
  entity_type: string
  entity_id: string
  assessment_status: string
  attention_score: number
  action_score: number
  verification_score: number
  attention_level: string
  action_level: string
  verification_level: string
  severity_component: number
  urgency_component: number
  exposure_component: number
  sensitivity_component: number
  confidence_component: number
  persistence_component: number
  domain_contributions: Record<string, number>
  score_explanation: Record<string, unknown>
  priority_reasons: string[]
  priority_limitations: string[]
  recommended_next_step: string
  finding_snapshot: unknown[]
  context_version: string
  rule_set_version: string
  priority_model_version: string
  previous_assessment_id: string | null
  score_delta: Record<string, number>
  level_change: Record<string, unknown>
  change_reasons: string[]
  evaluated_at: string
  valid_until: string
  created_at: string
  updated_at: string
}

export async function getActivePriorityAssessment(
  entityType: string,
  entityId: string,
  modelVersion: string,
): Promise<PriorityAssessmentRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('finding_priority_assessments')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('priority_model_version', modelVersion)
    .eq('assessment_status', 'active')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as PriorityAssessmentRow | null) ?? null
}

export async function listPriorityAssessmentHistory(
  entityType: string,
  entityId: string,
  limit = 20,
): Promise<PriorityAssessmentRow[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('finding_priority_assessments')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('evaluated_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data as PriorityAssessmentRow[]) ?? []
}

export function mapPriorityRowToAssessment(row: PriorityAssessmentRow): PriorityAssessment {
  return {
    id: row.id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    assessment_status: row.assessment_status as PriorityAssessment['assessment_status'],
    attention_score: Number(row.attention_score),
    action_score: Number(row.action_score),
    verification_score: Number(row.verification_score),
    attention_level: row.attention_level as PriorityAssessment['attention_level'],
    action_level: row.action_level as PriorityAssessment['action_level'],
    verification_level: row.verification_level as PriorityAssessment['verification_level'],
    severity_component: Number(row.severity_component),
    urgency_component: Number(row.urgency_component),
    exposure_component: Number(row.exposure_component),
    sensitivity_component: Number(row.sensitivity_component),
    confidence_component: Number(row.confidence_component),
    persistence_component: Number(row.persistence_component),
    domain_contributions: row.domain_contributions,
    score_explanation: row.score_explanation as PriorityAssessment['score_explanation'],
    priority_reasons: row.priority_reasons,
    priority_limitations: row.priority_limitations,
    recommended_next_step: row.recommended_next_step,
    finding_snapshot: row.finding_snapshot as PriorityAssessment['finding_snapshot'],
    context_version: row.context_version,
    rule_set_version: row.rule_set_version,
    priority_model_version: row.priority_model_version,
    previous_assessment_id: row.previous_assessment_id,
    score_delta: row.score_delta as PriorityAssessment['score_delta'],
    level_change: row.level_change as PriorityAssessment['level_change'],
    change_reasons: row.change_reasons,
    evaluated_at: row.evaluated_at,
    valid_until: row.valid_until,
  }
}

export async function persistPriorityEvaluation(
  result: PriorityEvaluationResult,
): Promise<{
  assessment_created: number
  assessment_updated: number
  assessment_superseded: number
  assessment_id: string
}> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const assessment = result.assessment
  const existing = await getActivePriorityAssessment(
    result.entity_type,
    result.entity_id,
    assessment.priority_model_version,
  )

  let assessment_created = 0
  let assessment_updated = 0
  let assessment_superseded = 0
  let assessment_id = existing?.id ?? ''

  const unchanged =
    existing &&
    existing.context_version === assessment.context_version &&
    Number(existing.attention_score) === assessment.attention_score &&
    Number(existing.verification_score) === assessment.verification_score &&
    Number(existing.action_score) === assessment.action_score

  if (unchanged && existing) {
    assessment_id = existing.id
    await supabase.from('finding_priority_evaluation_runs').insert({
      entity_type: result.entity_type,
      entity_id: result.entity_id,
      priority_model_version: assessment.priority_model_version,
      context_version: assessment.context_version,
      rule_set_version: assessment.rule_set_version,
      findings_count: result.findings_count,
      assessment_created: 0,
      assessment_updated: 0,
      assessment_superseded: 0,
      warnings: result.warnings,
      started_at: new Date(Date.now() - result.duration_ms).toISOString(),
      completed_at: now,
    })
    return { assessment_created: 0, assessment_updated: 0, assessment_superseded: 0, assessment_id }
  }

  if (existing) {
    const { error: supersedeError } = await supabase
      .from('finding_priority_assessments')
      .update({ assessment_status: 'superseded', updated_at: now })
      .eq('id', existing.id)
    if (supersedeError) throw new Error(supersedeError.message)
    assessment_superseded = 1
    assessment.previous_assessment_id = existing.id
  }

  const row = {
    entity_type: assessment.entity_type,
    entity_id: assessment.entity_id,
    assessment_status: 'active',
    attention_score: assessment.attention_score,
    action_score: assessment.action_score,
    verification_score: assessment.verification_score,
    attention_level: assessment.attention_level,
    action_level: assessment.action_level,
    verification_level: assessment.verification_level,
    severity_component: assessment.severity_component,
    urgency_component: assessment.urgency_component,
    exposure_component: assessment.exposure_component,
    sensitivity_component: assessment.sensitivity_component,
    confidence_component: assessment.confidence_component,
    persistence_component: assessment.persistence_component,
    domain_contributions: assessment.domain_contributions,
    score_explanation: assessment.score_explanation,
    priority_reasons: assessment.priority_reasons,
    priority_limitations: assessment.priority_limitations,
    recommended_next_step: assessment.recommended_next_step,
    finding_snapshot: assessment.finding_snapshot,
    context_version: assessment.context_version,
    rule_set_version: assessment.rule_set_version,
    priority_model_version: assessment.priority_model_version,
    previous_assessment_id: assessment.previous_assessment_id ?? null,
    score_delta: assessment.score_delta,
    level_change: assessment.level_change,
    change_reasons: assessment.change_reasons,
    evaluated_at: assessment.evaluated_at,
    valid_until: assessment.valid_until,
    updated_at: now,
  }

  const { data: inserted, error: insertError } = await supabase
    .from('finding_priority_assessments')
    .insert(row)
    .select('id')
    .single()
  if (insertError) throw new Error(insertError.message)

  assessment_id = String(inserted.id)
  assessment_created = existing ? 0 : 1
  assessment_updated = existing ? 1 : 0

  const { error: runError } = await supabase.from('finding_priority_evaluation_runs').insert({
    entity_type: result.entity_type,
    entity_id: result.entity_id,
    priority_model_version: assessment.priority_model_version,
    context_version: assessment.context_version,
    rule_set_version: assessment.rule_set_version,
    findings_count: result.findings_count,
    assessment_created,
    assessment_updated,
    assessment_superseded,
    warnings: result.warnings,
    started_at: new Date(Date.now() - result.duration_ms).toISOString(),
    completed_at: now,
  })
  if (runError) throw new Error(runError.message)

  return { assessment_created, assessment_updated, assessment_superseded, assessment_id }
}

export async function listPriorityAssessments(filters: {
  assessment_status?: string
  attention_level?: string
  verification_level?: string
  action_level?: string
  entity_type?: string
  department_code?: string
  limit?: number
  offset?: number
}): Promise<PriorityAssessmentRow[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('finding_priority_assessments')
    .select('*')
    .order('attention_score', { ascending: false })
    .order('evaluated_at', { ascending: false })

  if (filters.assessment_status) query = query.eq('assessment_status', filters.assessment_status)
  else query = query.eq('assessment_status', 'active')
  if (filters.attention_level) query = query.eq('attention_level', filters.attention_level)
  if (filters.verification_level) query = query.eq('verification_level', filters.verification_level)
  if (filters.action_level) query = query.eq('action_level', filters.action_level)
  if (filters.entity_type) query = query.eq('entity_type', filters.entity_type)

  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  let rows = (data as PriorityAssessmentRow[]) ?? []
  if (filters.department_code) {
    rows = rows.filter((r) => {
      const snap = r.finding_snapshot as Array<{ finding_id?: string }>
      return snap.length > 0
    })
  }
  return rows
}

export async function getPriorityAssessmentById(id: string): Promise<PriorityAssessmentRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('finding_priority_assessments')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as PriorityAssessmentRow | null) ?? null
}

export async function countActivePriorityAssessments(): Promise<number> {
  const supabase = getSupabaseAdmin()
  const { count, error } = await supabase
    .from('finding_priority_assessments')
    .select('*', { count: 'exact', head: true })
    .eq('assessment_status', 'active')
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function expireActivePriorityAssessment(
  entityType: string,
  entityId: string,
  modelVersion: string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('finding_priority_assessments')
    .update({ assessment_status: 'expired', updated_at: now })
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('priority_model_version', modelVersion)
    .eq('assessment_status', 'active')
    .select('id')
  if (error) throw new Error(error.message)
  return (data ?? []).length > 0
}
