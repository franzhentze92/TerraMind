import type { MissionCreationResult } from '@/modules/missions/missions.types'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export async function hasMissionCreationSignature(
  planId: string,
  signature: string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('mission_creation_evaluation_runs')
    .select('id')
    .eq('verification_plan_id', planId)
    .eq('context_signature', signature)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function insertMissionCreationEvaluationRun(input: {
  result: MissionCreationResult
  missionId: string | null
  warnings?: string[]
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('mission_creation_evaluation_runs').insert({
    verification_plan_id: input.result.verification_plan_id,
    mission_profile_version: input.result.mission_profile_version,
    context_signature: input.result.context_signature,
    mission_id: input.missionId,
    creation_decision: input.result.decision,
    warnings: input.warnings ?? input.result.warnings,
    evaluated_at: input.result.evaluated_at,
  })
  if (error) {
    if (error.code === '23505') return
    throw new Error(error.message)
  }
}
