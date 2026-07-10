import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import type {
  ConflictFlagResult,
  RequirementLinkValidation,
  ValidationCheckResult,
  ValidationDecisionResult,
} from '@/modules/evidence/validation/evidence-validation.types'
import { VALIDATION_MODEL_VERSION } from '@/modules/evidence/config/fire-evidence-validation.config'

export async function getActiveValidation(submissionId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('evidence_validations')
    .select('*')
    .eq('submission_id', submissionId)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function listValidationHistory(submissionId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('evidence_validations')
    .select('*')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listMissionValidations(missionId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('evidence_validations')
    .select('*, evidence_submissions!inner(mission_id)')
    .eq('evidence_submissions.mission_id', missionId)
    .eq('is_active', true)
    .order('validated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function findValidationEvalByContext(
  submissionId: string,
  contextSignature: string,
) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('evidence_validation_evaluation_runs')
    .select('*')
    .eq('submission_id', submissionId)
    .eq('context_signature', contextSignature)
    .eq('validation_model_version', VALIDATION_MODEL_VERSION)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function deactivateActiveValidation(submissionId: string): Promise<string | null> {
  const active = await getActiveValidation(submissionId)
  if (!active) return null
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('evidence_validations')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', active.id as string)
  if (error) throw new Error(error.message)
  return active.id as string
}

export async function supersedeActiveValidation(input: {
  submissionId: string
  newValidationId: string
}) {
  const supabase = getSupabaseAdmin()
  const active = await getActiveValidation(input.submissionId)
  if (!active || active.id === input.newValidationId) return
  const now = new Date().toISOString()

  const { error: oldError } = await supabase
    .from('evidence_validations')
    .update({
      is_active: false,
      status: 'superseded',
      superseded_by_validation_id: input.newValidationId,
      updated_at: now,
    })
    .eq('id', active.id as string)
  if (oldError) throw new Error(oldError.message)

  const { error: newError } = await supabase
    .from('evidence_validations')
    .update({
      supersedes_validation_id: active.id as string,
      updated_at: now,
    })
    .eq('id', input.newValidationId)
  if (newError) throw new Error(newError.message)
}

export async function insertValidation(
  submissionId: string,
  result: ValidationDecisionResult,
): Promise<string> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('evidence_validations')
    .insert({
      submission_id: submissionId,
      validation_model_version: VALIDATION_MODEL_VERSION,
      status: result.status,
      decision_reason: result.decision_reason,
      decision_rules: result.decision_rules,
      rejection_reason_code: result.rejection_reason_code,
      limitations: result.limitations,
      recommended_follow_up: result.recommended_follow_up,
      evidence_strength: result.evidence_strength,
      technical_integrity_score: result.scores.technical_integrity_score,
      provenance_score: result.scores.provenance_score,
      temporal_relevance_score: result.scores.temporal_relevance_score,
      spatial_relevance_score: result.scores.spatial_relevance_score,
      semantic_relevance_score: result.scores.semantic_relevance_score,
      completeness_score: result.scores.completeness_score,
      source_independence_score: result.scores.source_independence_score,
      usability_score: result.scores.usability_score,
      overall_quality_score: result.scores.overall_quality_score,
      score_explanation: result.score_explanation,
      context_signature: result.context_signature,
      is_active: true,
      validated_at: now,
      updated_at: now,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id as string
}

export async function insertValidationChecks(
  validationId: string,
  checks: ValidationCheckResult[],
) {
  if (checks.length === 0) return
  const supabase = getSupabaseAdmin()
  const rows = checks.map((c) => ({
    validation_id: validationId,
    dimension: c.dimension,
    check_code: c.check_code,
    outcome: c.outcome,
    message: c.message,
    weight: c.weight,
  }))
  const { error } = await supabase
    .from('evidence_validation_checks')
    .upsert(rows, { onConflict: 'validation_id,check_code' })
  if (error) throw new Error(error.message)
}

export async function updateRequirementLinkCoverage(
  submissionId: string,
  links: RequirementLinkValidation[],
) {
  const supabase = getSupabaseAdmin()
  for (const link of links) {
    const { error } = await supabase
      .from('evidence_requirement_links')
      .update({ valid_coverage_status: link.valid_coverage_status })
      .eq('submission_id', submissionId)
      .eq('requirement_id', link.requirement_id)
    if (error) throw new Error(error.message)
  }
}

export async function upsertConflictFlags(
  missionId: string,
  flags: ConflictFlagResult[],
) {
  if (flags.length === 0) return
  const supabase = getSupabaseAdmin()
  const rows = flags.map((f) => ({
    mission_id: missionId,
    submission_id_a: f.submission_id_a,
    submission_id_b: f.submission_id_b,
    conflict_type: f.conflict_type,
    conflict_field: f.conflict_field,
    description: f.description,
    status: 'potential',
  }))
  const { error } = await supabase
    .from('evidence_conflict_flags')
    .upsert(rows, {
      onConflict: 'mission_id,submission_id_a,submission_id_b,conflict_type,conflict_field',
    })
  if (error) throw new Error(error.message)
}

export async function recordValidationEvent(input: {
  validationId: string
  submissionId: string
  eventType: string
  actorType?: 'system' | 'user'
  actorId?: string | null
  payload?: Record<string, unknown>
}) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('evidence_validation_events').insert({
    validation_id: input.validationId,
    submission_id: input.submissionId,
    event_type: input.eventType,
    actor_type: input.actorType ?? 'system',
    actor_id: input.actorId ?? null,
    payload: input.payload ?? {},
    validation_model_version: VALIDATION_MODEL_VERSION,
  })
  if (error) throw new Error(error.message)
}

export async function recordValidationEvaluationRun(input: {
  submissionId: string
  validationId: string | null
  action: string
  contextSignature: string
  idempotencyKey?: string | null
  decision: string
  warnings: string[]
}) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('evidence_validation_evaluation_runs').insert({
    submission_id: input.submissionId,
    validation_id: input.validationId,
    action: input.action,
    context_signature: input.contextSignature,
    validation_model_version: VALIDATION_MODEL_VERSION,
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

export async function enqueueVerificationResolutionCandidate(missionId: string, reason: string) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('verification_resolution_candidates').insert({
    mission_id: missionId,
    trigger_reason: reason,
    status: 'pending',
    updated_at: new Date().toISOString(),
  })
  if (error) {
    if (error.code === '23505') return
    throw new Error(error.message)
  }
}

export async function getValidationChecks(validationId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('evidence_validation_checks')
    .select('*')
    .eq('validation_id', validationId)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listMissionConflictFlags(missionId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('evidence_conflict_flags')
    .select('*')
    .eq('mission_id', missionId)
    .eq('status', 'potential')
  if (error) throw new Error(error.message)
  return data ?? []
}
