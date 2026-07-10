import { RESOLUTION_MODEL_VERSION } from '@/modules/verification/config/fire-verification-resolution.config'
import type { NeedResolutionResult } from '@/modules/verification/resolution/verification-resolution.types'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export async function getActiveNeedResolution(needId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('verification_need_resolutions')
    .select('*')
    .eq('verification_need_id', needId)
    .eq('resolution_model_version', RESOLUTION_MODEL_VERSION)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function listNeedResolutionHistory(needId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('verification_need_resolutions')
    .select('*')
    .eq('verification_need_id', needId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listPlanActiveResolutions(planId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('verification_need_resolutions')
    .select('*')
    .eq('plan_id', planId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listIncidentActiveResolutions(incidentId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('verification_need_resolutions')
    .select('*')
    .eq('incident_id', incidentId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function findResolutionEvalByContext(needId: string, contextSignature: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('verification_resolution_evaluation_runs')
    .select('*')
    .eq('verification_need_id', needId)
    .eq('context_signature', contextSignature)
    .eq('resolution_model_version', RESOLUTION_MODEL_VERSION)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function recordResolutionEvaluationRun(input: {
  needId: string
  resolutionId: string | null
  action: string
  contextSignature: string
  idempotencyKey?: string | null
  decision: string
  warnings: string[]
}) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('verification_resolution_evaluation_runs').insert({
    verification_need_id: input.needId,
    resolution_id: input.resolutionId,
    action: input.action,
    context_signature: input.contextSignature,
    resolution_model_version: RESOLUTION_MODEL_VERSION,
    idempotency_key: input.idempotencyKey ?? null,
    decision: input.decision,
    warnings: input.warnings,
    evaluated_at: new Date().toISOString(),
  })
  if (error) {
    if (error.code === '23505') return { duplicate: true }
    throw new Error(error.message)
  }
  return { duplicate: false }
}

export async function deactivateActiveNeedResolution(needId: string): Promise<string | null> {
  const active = await getActiveNeedResolution(needId)
  if (!active) return null
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('verification_need_resolutions')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', active.id as string)
  if (error) throw new Error(error.message)
  return active.id as string
}

export async function insertNeedResolution(input: {
  needId: string
  planId: string
  incidentId: string
  result: NeedResolutionResult
  previousResolutionId: string | null
}): Promise<string> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('verification_need_resolutions')
    .insert({
      verification_need_id: input.needId,
      plan_id: input.planId,
      incident_id: input.incidentId,
      resolution_model_version: RESOLUTION_MODEL_VERSION,
      resolution_status: input.result.resolution_status,
      resolution_confidence: input.result.resolution_confidence,
      resolution_strength: input.result.resolution_strength,
      resolution_reasons: input.result.resolution_reasons,
      resolution_limitations: input.result.resolution_limitations,
      remaining_uncertainties: input.result.remaining_uncertainties,
      recommended_follow_up: input.result.recommended_follow_up,
      alternative_method_recommended: input.result.alternative_method_recommended,
      evidence_bundle: input.result.evidence_bundle,
      requirements_coverage: input.result.requirements_coverage,
      conflict_assessment: input.result.conflict_assessment,
      evidence_sufficiency_score: input.result.scores.evidence_sufficiency_score,
      coverage_score: input.result.scores.coverage_score,
      corroboration_score: input.result.scores.corroboration_score,
      conflict_penalty: input.result.scores.conflict_penalty,
      temporal_fit_score: input.result.scores.temporal_fit_score,
      spatial_fit_score: input.result.scores.spatial_fit_score,
      resolution_confidence_score: input.result.scores.resolution_confidence_score,
      context_signature: input.result.context_signature,
      is_active: true,
      previous_resolution_id: input.previousResolutionId,
      resolved_at: now,
      updated_at: now,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id as string
}

export async function insertResolutionEvidenceLinks(
  resolutionId: string,
  result: NeedResolutionResult,
) {
  const supabase = getSupabaseAdmin()
  const rows = [
    ...result.evidence_bundle.validations_used.map((validationId, i) => ({
      resolution_id: resolutionId,
      submission_id: result.evidence_bundle.submissions_considered[i],
      validation_id: validationId,
      link_role: 'used',
    })),
    ...result.evidence_bundle.submissions_discarded.map((d) => ({
      resolution_id: resolutionId,
      submission_id: d.submission_id,
      validation_id: null,
      link_role: 'discarded',
      discard_reason: d.reason,
    })),
  ].filter((r) => r.submission_id)

  if (rows.length === 0) return
  const { error } = await supabase.from('verification_resolution_evidence_links').insert(rows)
  if (error) throw new Error(error.message)
}

export async function updateNeedResolutionStatus(needId: string, status: string) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('verification_needs')
    .update({ resolution_status: status, updated_at: new Date().toISOString() })
    .eq('id', needId)
  if (error) throw new Error(error.message)
}

export async function updatePlanResolutionStatus(planId: string, status: string, reason: string) {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data: plan, error: fetchError } = await supabase
    .from('verification_plans')
    .select('status')
    .eq('id', planId)
    .single()
  if (fetchError) throw new Error(fetchError.message)

  const fromStatus = plan?.status as string
  if (fromStatus === status) return

  const { error } = await supabase
    .from('verification_plans')
    .update({ status, updated_at: now })
    .eq('id', planId)
  if (error) throw new Error(error.message)

  await supabase.from('verification_plan_resolution_history').insert({
    plan_id: planId,
    from_status: fromStatus,
    to_status: status,
    reason,
    resolution_model_version: RESOLUTION_MODEL_VERSION,
  })
}

export async function recordResolutionEvent(input: {
  resolutionId: string
  needId: string
  planId: string
  eventType: string
  payload?: Record<string, unknown>
}) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('verification_resolution_events').insert({
    resolution_id: input.resolutionId,
    need_id: input.needId,
    plan_id: input.planId,
    event_type: input.eventType,
    actor_type: 'system',
    payload: input.payload ?? {},
    resolution_model_version: RESOLUTION_MODEL_VERSION,
  })
  if (error) throw new Error(error.message)
}

export async function enqueueReevaluationRequests(input: {
  incidentId: string
  planId: string
  needId: string
  resolutionId: string
  effects: string[]
  contextSignature: string
}) {
  if (input.effects.length === 0) return
  const supabase = getSupabaseAdmin()
  const rows = input.effects.map((effect_type) => ({
    incident_id: input.incidentId,
    plan_id: input.planId,
    need_id: input.needId,
    resolution_id: input.resolutionId,
    effect_type,
    status: 'pending',
    context_signature: input.contextSignature,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from('resolution_reevaluation_requests').insert(rows)
  if (error) {
    if (error.code === '23505') return
    throw new Error(error.message)
  }
}

export async function listResolutionEvidenceLinks(resolutionId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('verification_resolution_evidence_links')
    .select('*')
    .eq('resolution_id', resolutionId)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listPendingReevaluationRequests(incidentId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('resolution_reevaluation_requests')
    .select('*')
    .eq('incident_id', incidentId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function claimVerificationResolutionCandidate(): Promise<{
  id: string
  mission_id: string
} | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('verification_resolution_candidates')
    .select('id, mission_id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  const { error: updateError } = await supabase
    .from('verification_resolution_candidates')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', data.id)
    .eq('status', 'pending')
  if (updateError) throw new Error(updateError.message)
  return { id: data.id as string, mission_id: data.mission_id as string }
}

export async function completeVerificationResolutionCandidate(id: string) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('verification_resolution_candidates')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listMissionResolutionContributions(missionId: string) {
  const supabase = getSupabaseAdmin()
  const { data: submissions, error: subError } = await supabase
    .from('evidence_submissions')
    .select('id')
    .eq('mission_id', missionId)
  if (subError) throw new Error(subError.message)
  const submissionIds = (submissions ?? []).map((s) => s.id as string)
  if (submissionIds.length === 0) return []

  const { data: links, error } = await supabase
    .from('verification_resolution_evidence_links')
    .select('*, verification_need_resolutions!inner(verification_need_id, resolution_status, plan_id)')
    .in('submission_id', submissionIds)
    .eq('link_role', 'used')
  if (error) throw new Error(error.message)
  return links ?? []
}
