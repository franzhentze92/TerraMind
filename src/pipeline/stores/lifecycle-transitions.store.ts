import type { FireLifecycleState } from '@/modules/lifecycle/lifecycle.types'
import type { LifecycleEvaluationResult } from '@/modules/lifecycle/lifecycle.types'
import { FIRE_LIFECYCLE_WINDOWS } from '@/modules/lifecycle/config/fire-lifecycle.config'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export interface LifecycleTransitionRow {
  id: string
  entity_type: string
  entity_id: string
  previous_state: string | null
  new_state: string
  transitioned: boolean
  transition_reason: string
  transition_rule: string | null
  evidence_snapshot: Record<string, unknown>
  source_detection_ids: string[]
  lifecycle_model_version: string
  context_signature: string
  previous_transition_id: string | null
  evaluated_at: string
  created_at: string
}

export async function getLatestLifecycleTransition(
  entityType: string,
  entityId: string,
): Promise<LifecycleTransitionRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('event_lifecycle_transitions')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('evaluated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as LifecycleTransitionRow | null) ?? null
}

export async function hasLifecycleSignature(
  entityType: string,
  entityId: string,
  signature: string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('event_lifecycle_transitions')
    .select('id')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('context_signature', signature)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

function computeTemporalFields(
  newState: FireLifecycleState,
  evaluatedAt: string,
  previous: LifecycleTransitionRow | null,
): {
  state_changed_at: string
  inactive_since: string | null
  monitoring_until: string | null
  resolved_at: string | null
  reactivated_at: string | null
} {
  const now = evaluatedAt
  const prevState = previous?.new_state as FireLifecycleState | undefined

  let inactive_since: string | null = null
  let monitoring_until: string | null = null
  let resolved_at: string | null = null
  let reactivated_at: string | null = null
  let state_changed_at = now

  if (newState === 'inactive_monitoring') {
    inactive_since = now
    monitoring_until = new Date(
      new Date(now).getTime() + FIRE_LIFECYCLE_WINDOWS.resolvedHours * 3_600_000,
    ).toISOString()
  }
  if (newState === 'resolved') {
    resolved_at = now
  }
  if (newState === 'reactivated') {
    reactivated_at = now
  }

  if (newState === previous?.new_state) {
    state_changed_at = previous?.evaluated_at ?? now
  }

  if (prevState === newState && previous) {
    return {
      state_changed_at: previous.evaluated_at,
      inactive_since,
      monitoring_until,
      resolved_at,
      reactivated_at,
    }
  }

  return { state_changed_at, inactive_since, monitoring_until, resolved_at, reactivated_at }
}

export async function persistLifecycleEvaluation(
  evaluation: LifecycleEvaluationResult,
  previousTransition: LifecycleTransitionRow | null,
): Promise<{
  transition_id: string | null
  skipped_duplicate: boolean
  transition_persisted: boolean
}> {
  const duplicate = await hasLifecycleSignature(
    evaluation.entity_type,
    evaluation.entity_id,
    evaluation.context_signature,
  )
  if (duplicate) {
    return { transition_id: null, skipped_duplicate: true, transition_persisted: false }
  }

  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const temporal = computeTemporalFields(
    evaluation.new_state,
    evaluation.evaluated_at,
    previousTransition,
  )

  const { data: transition, error: transitionError } = await supabase
    .from('event_lifecycle_transitions')
    .insert({
      entity_type: evaluation.entity_type,
      entity_id: evaluation.entity_id,
      previous_state: evaluation.previous_state,
      new_state: evaluation.new_state,
      transitioned: evaluation.transitioned,
      transition_reason: evaluation.transition_reason,
      transition_rule: evaluation.transition_rule,
      evidence_snapshot: evaluation.evidence_snapshot,
      source_detection_ids: evaluation.source_detection_ids,
      lifecycle_model_version: evaluation.lifecycle_model_version,
      context_signature: evaluation.context_signature,
      previous_transition_id: previousTransition?.id ?? null,
      evaluated_at: evaluation.evaluated_at,
    })
    .select('id')
    .single()

  if (transitionError) {
    if (transitionError.code === '23505') {
      return { transition_id: null, skipped_duplicate: true, transition_persisted: false }
    }
    throw new Error(transitionError.message)
  }

  const eventUpdate: Record<string, unknown> = {
    lifecycle_state: evaluation.new_state,
    lifecycle_model_version: evaluation.lifecycle_model_version,
    state_changed_at: evaluation.transitioned ? temporal.state_changed_at : temporal.state_changed_at,
    updated_at: now,
  }
  if (evaluation.new_state === 'inactive_monitoring') {
    eventUpdate.inactive_since = temporal.inactive_since
    eventUpdate.monitoring_until = temporal.monitoring_until
  }
  if (evaluation.new_state === 'resolved' && evaluation.transitioned) {
    eventUpdate.resolved_at = temporal.resolved_at ?? now
  }
  if (evaluation.new_state === 'reactivated' && evaluation.transitioned) {
    eventUpdate.reactivated_at = temporal.reactivated_at ?? now
  }

  const { error: eventError } = await supabase
    .from('fire_events')
    .update(eventUpdate)
    .eq('id', evaluation.entity_id)

  if (eventError) throw new Error(eventError.message)

  return {
    transition_id: String(transition.id),
    skipped_duplicate: false,
    transition_persisted: true,
  }
}

export async function listLifecycleTransitions(
  entityType: string,
  entityId: string,
  limit = 50,
): Promise<LifecycleTransitionRow[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('event_lifecycle_transitions')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('evaluated_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data as LifecycleTransitionRow[]) ?? []
}

export async function insertLifecycleEvaluationRun(input: {
  evaluation: LifecycleEvaluationResult
  transition_id: string | null
  findings_jobs_enqueued: number
  priority_jobs_enqueued: number
  findings_synced: number
  warnings: string[]
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase.from('event_lifecycle_evaluation_runs').insert({
    entity_type: input.evaluation.entity_type,
    entity_id: input.evaluation.entity_id,
    lifecycle_model_version: input.evaluation.lifecycle_model_version,
    context_signature: input.evaluation.context_signature,
    previous_state: input.evaluation.previous_state,
    new_state: input.evaluation.new_state,
    transitioned: input.evaluation.transitioned,
    transition_id: input.transition_id,
    findings_jobs_enqueued: input.findings_jobs_enqueued,
    priority_jobs_enqueued: input.priority_jobs_enqueued,
    findings_synced: input.findings_synced,
    warnings: input.warnings,
    started_at: new Date(Date.now() - input.evaluation.duration_ms).toISOString(),
    completed_at: now,
  })
  if (error) throw new Error(error.message)
}
