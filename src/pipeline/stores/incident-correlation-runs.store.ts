import type { CorrelationEvaluationResult } from '@/modules/incidents/incidents.types'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export async function hasCorrelationSignature(
  eventType: string,
  eventId: string,
  signature: string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('incident_correlation_evaluation_runs')
    .select('id')
    .eq('event_type', eventType)
    .eq('event_id', eventId)
    .eq('context_signature', signature)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function insertCorrelationEvaluationRun(input: {
  evaluation: CorrelationEvaluationResult
  incidentId: string | null
  membershipId: string | null
  warnings?: string[]
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('incident_correlation_evaluation_runs').insert({
    event_type: input.evaluation.event_type,
    event_id: input.evaluation.event_id,
    correlation_model_version: input.evaluation.correlation_model_version,
    context_signature: input.evaluation.context_signature,
    correlation_decision: input.evaluation.correlation_decision,
    correlation_score: input.evaluation.scores.correlation_score,
    spatial_score: input.evaluation.scores.spatial_score,
    temporal_score: input.evaluation.scores.temporal_score,
    semantic_score: input.evaluation.scores.semantic_score,
    source_diversity_score: input.evaluation.scores.source_diversity_score,
    lifecycle_compatibility: input.evaluation.scores.lifecycle_compatibility,
    correlation_reasons: input.evaluation.correlation_reasons,
    correlation_limitations: input.evaluation.correlation_limitations,
    rejected_reasons: input.evaluation.rejected_reasons,
    candidates_considered: input.evaluation.candidates_considered,
    incidents_considered: input.evaluation.candidates_considered.filter(
      (c) => c.kind === 'incident',
    ),
    evidence_snapshot: input.evaluation.evidence_snapshot,
    incident_id: input.incidentId,
    membership_id: input.membershipId,
    warnings: input.warnings ?? input.evaluation.warnings,
    evaluated_at: input.evaluation.evaluated_at,
  })
  if (error) {
    if (error.code === '23505') return
    throw new Error(error.message)
  }
}

export async function listCorrelationRunsForEvent(
  eventType: string,
  eventId: string,
  limit = 50,
): Promise<Array<Record<string, unknown>>> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('incident_correlation_evaluation_runs')
    .select('*')
    .eq('event_type', eventType)
    .eq('event_id', eventId)
    .order('evaluated_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data as Array<Record<string, unknown>>) ?? []
}
