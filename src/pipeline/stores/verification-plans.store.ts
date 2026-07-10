import type { VerificationPlanResult } from '@/modules/verification/verification.types'
import { FIRE_VERIFICATION_METHOD_CATALOG_VERSION } from '@/modules/verification/config/fire-verification.config'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export interface VerificationPlanRow {
  id: string
  incident_id: string
  status: string
  verification_model_version: string
  incident_snapshot: Record<string, unknown>
  plan_priority: number
  plan_reasons: string[]
  plan_limitations: string[]
  recommended_window: Record<string, unknown>
  evidence_requirements: unknown[]
  context_signature: string
  previous_plan_id: string | null
  mission_candidate_pending: boolean
  created_at: string
  updated_at: string
  superseded_at: string | null
}

export async function getActiveVerificationPlan(
  incidentId: string,
  modelVersion: string,
): Promise<VerificationPlanRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('verification_plans')
    .select('*')
    .eq('incident_id', incidentId)
    .eq('verification_model_version', modelVersion)
    .in('status', ['draft', 'ready', 'not_required', 'blocked'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as VerificationPlanRow | null) ?? null
}

export async function getVerificationPlanById(id: string): Promise<VerificationPlanRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('verification_plans')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as VerificationPlanRow | null) ?? null
}

export async function supersedeActiveVerificationPlan(
  incidentId: string,
  modelVersion: string,
): Promise<string | null> {
  const active = await getActiveVerificationPlan(incidentId, modelVersion)
  if (!active) return null
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('verification_plans')
    .update({ status: 'superseded', superseded_at: now, updated_at: now })
    .eq('id', active.id)
  if (error) throw new Error(error.message)
  return active.id
}

export async function persistVerificationPlan(
  result: VerificationPlanResult,
  previousPlanId: string | null,
): Promise<string> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  const evidenceRequirements = result.needs.map((n) => ({
    need_type: n.need_type,
    evidence_minimum: n.evidence_minimum,
    success_criteria: n.success_criteria,
    inconclusive_criteria: n.inconclusive_criteria,
    failure_criteria: n.failure_criteria,
  }))

  const { data: plan, error: planError } = await supabase
    .from('verification_plans')
    .insert({
      incident_id: result.incident_id,
      status: result.status,
      verification_model_version: result.verification_model_version,
      incident_snapshot: result.incident_snapshot,
      plan_priority: result.plan_priority,
      plan_reasons: result.plan_reasons,
      plan_limitations: result.plan_limitations,
      recommended_window: result.recommended_window,
      evidence_requirements: evidenceRequirements,
      context_signature: result.context_signature,
      previous_plan_id: previousPlanId,
      mission_candidate_pending: result.mission_candidate_pending,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()
  if (planError) throw new Error(planError.message)
  const planId = String(plan.id)

  for (const need of result.needs) {
    const { data: needRow, error: needError } = await supabase
      .from('verification_needs')
      .insert({
        plan_id: planId,
        need_type: need.need_type,
        need_question: need.need_question,
        priority: need.priority,
        derivation_reasons: need.derivation_reasons,
        evidence_minimum: need.evidence_minimum,
        success_criteria: { text: need.success_criteria },
        inconclusive_criteria: { text: need.inconclusive_criteria },
        failure_criteria: { text: need.failure_criteria },
        recommended_window: { hours: need.recommended_window_hours },
        recommended_method_id: need.recommended_method?.method_id ?? null,
        alternative_method_ids: need.alternative_methods.map((m) => m.method_id),
        selection_reason: need.selection_reason,
      })
      .select('id')
      .single()
    if (needError) throw new Error(needError.message)
    const needId = String(needRow.id)

    const allMethods = [
      ...(need.recommended_method ? [need.recommended_method] : []),
      ...need.alternative_methods,
    ]
    for (const method of allMethods) {
      const { error: methodError } = await supabase.from('verification_method_candidates').insert({
        plan_id: planId,
        need_id: needId,
        method_id: method.method_id,
        method_type: method.method_type,
        is_recommended: method.is_recommended,
        is_alternative: method.is_alternative,
        is_blocked: method.is_blocked,
        suitability_score: method.suitability_score,
        information_gain_score: method.information_gain_score,
        urgency_fit_score: method.urgency_fit_score,
        cost_efficiency_score: method.cost_efficiency_score,
        availability_score: method.availability_score,
        evidence_strength_score: method.evidence_strength_score,
        ranking_reasons: method.ranking_reasons,
        ranking_limitations: method.ranking_limitations,
        constraints: method.constraints,
        method_catalog_version: FIRE_VERIFICATION_METHOD_CATALOG_VERSION,
      })
      if (methodError) throw new Error(methodError.message)
    }
  }

  return planId
}

export async function listVerificationPlans(filters: {
  status?: string
  domain?: string
  min_priority?: number
  requires_field?: boolean
  requires_external?: boolean
  limit?: number
}): Promise<VerificationPlanRow[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('verification_plans')
    .select('*')
    .in('status', ['draft', 'ready', 'not_required', 'blocked'])
    .order('plan_priority', { ascending: false })
    .limit(filters.limit ?? 100)

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.min_priority != null) query = query.gte('plan_priority', filters.min_priority)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  let rows = (data as VerificationPlanRow[]) ?? []

  if (filters.domain) {
    rows = rows.filter(
      (r) => (r.incident_snapshot as { domain?: string }).domain === filters.domain,
    )
  }

  return rows
}

export async function listVerificationNeedsForPlan(planId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('verification_needs')
    .select('*')
    .eq('plan_id', planId)
    .order('priority', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listMethodCandidatesForPlan(planId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('verification_method_candidates')
    .select('*')
    .eq('plan_id', planId)
  if (error) throw new Error(error.message)
  return data ?? []
}
