import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import {
  getLatestLifecycleTransition,
  listLifecycleTransitions,
} from '@/pipeline/stores/lifecycle-transitions.store'
import { FIRE_LIFECYCLE_MODEL_VERSION } from '@/modules/lifecycle/config/fire-lifecycle.config'

export interface LifecycleSummaryDto {
  entity_type: string
  entity_id: string
  lifecycle_state: string | null
  lifecycle_model_version: string | null
  state_changed_at: string | null
  first_detected_at: string | null
  last_detected_at: string | null
  inactive_since: string | null
  monitoring_until: string | null
  resolved_at: string | null
  reactivated_at: string | null
  time_in_state_hours: number | null
  latest_transition: {
    id: string
    previous_state: string | null
    new_state: string
    transition_reason: string
    transition_rule: string | null
    evaluated_at: string
  } | null
}

export async function getEntityLifecycle(
  entityType: string,
  entityId: string,
): Promise<LifecycleSummaryDto | null> {
  if (entityType !== 'fire_event') return null

  const supabase = getSupabaseAdmin()
  const { data: event, error } = await supabase
    .from('fire_events')
    .select(
      'id, lifecycle_state, lifecycle_model_version, state_changed_at, first_detected_at, last_detected_at, inactive_since, monitoring_until, resolved_at, reactivated_at',
    )
    .eq('id', entityId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!event) return null

  const latest = await getLatestLifecycleTransition(entityType, entityId)
  const stateChangedAt = event.state_changed_at ? String(event.state_changed_at) : null
  const timeInStateHours = stateChangedAt
    ? Math.round(
        ((Date.now() - new Date(stateChangedAt).getTime()) / 3_600_000) * 10,
      ) / 10
    : null

  return {
    entity_type: entityType,
    entity_id: entityId,
    lifecycle_state: event.lifecycle_state ? String(event.lifecycle_state) : null,
    lifecycle_model_version: event.lifecycle_model_version
      ? String(event.lifecycle_model_version)
      : FIRE_LIFECYCLE_MODEL_VERSION,
    state_changed_at: stateChangedAt,
    first_detected_at: event.first_detected_at ? String(event.first_detected_at) : null,
    last_detected_at: event.last_detected_at ? String(event.last_detected_at) : null,
    inactive_since: event.inactive_since ? String(event.inactive_since) : null,
    monitoring_until: event.monitoring_until ? String(event.monitoring_until) : null,
    resolved_at: event.resolved_at ? String(event.resolved_at) : null,
    reactivated_at: event.reactivated_at ? String(event.reactivated_at) : null,
    time_in_state_hours: timeInStateHours,
    latest_transition: latest
      ? {
          id: latest.id,
          previous_state: latest.previous_state,
          new_state: latest.new_state,
          transition_reason: latest.transition_reason,
          transition_rule: latest.transition_rule,
          evaluated_at: latest.evaluated_at,
        }
      : null,
  }
}

export async function getEntityLifecycleTransitions(
  entityType: string,
  entityId: string,
  limit = 50,
) {
  const rows = await listLifecycleTransitions(entityType, entityId, limit)
  return {
    items: rows.map((r) => ({
      id: r.id,
      previous_state: r.previous_state,
      new_state: r.new_state,
      transitioned: r.transitioned,
      transition_reason: r.transition_reason,
      transition_rule: r.transition_rule,
      evidence_snapshot: r.evidence_snapshot,
      source_detection_ids: r.source_detection_ids,
      lifecycle_model_version: r.lifecycle_model_version,
      evaluated_at: r.evaluated_at,
    })),
    generated_at: new Date().toISOString(),
  }
}
