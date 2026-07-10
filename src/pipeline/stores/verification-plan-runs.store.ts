import type { VerificationPlanResult } from '@/modules/verification/verification.types'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export async function hasVerificationPlanSignature(
  incidentId: string,
  signature: string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('verification_plan_evaluation_runs')
    .select('id')
    .eq('incident_id', incidentId)
    .eq('context_signature', signature)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function insertVerificationPlanEvaluationRun(input: {
  result: VerificationPlanResult
  planId: string | null
  warnings?: string[]
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const methodsCount = input.result.needs.reduce(
    (acc, n) =>
      acc + (n.recommended_method ? 1 : 0) + n.alternative_methods.length,
    0,
  )
  const { error } = await supabase.from('verification_plan_evaluation_runs').insert({
    incident_id: input.result.incident_id,
    verification_model_version: input.result.verification_model_version,
    context_signature: input.result.context_signature,
    plan_id: input.planId,
    plan_status: input.result.status,
    needs_count: input.result.needs.length,
    methods_count: methodsCount,
    mission_candidate_pending: input.result.mission_candidate_pending,
    warnings: input.warnings ?? input.result.warnings,
    evaluated_at: input.result.evaluated_at,
  })
  if (error) {
    if (error.code === '23505') return
    throw new Error(error.message)
  }
}
