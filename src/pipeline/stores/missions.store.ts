import type { MissionCreationResult } from '@/modules/missions/missions.types'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export interface MissionRow {
  id: string
  mission_type: string
  domain: string
  title: string
  objective: string
  status: string
  incident_id: string
  verification_plan_id: string
  primary_verification_need_id: string | null
  recommended_method_code: string
  location_geometry: Record<string, unknown> | null
  location_description: string
  priority: number
  earliest_start_at: string
  due_at: string
  expires_at: string
  completion_criteria: Record<string, unknown>
  inconclusive_criteria: Record<string, unknown>
  blocking_conditions: unknown[]
  cancellation_conditions: unknown[]
  mission_profile_version: string
  source_snapshot: Record<string, unknown>
  context_signature: string
  superseded_by_mission_id: string | null
  supersedes_mission_id: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  cancelled_at: string | null
}

const ACTIVE_STATUSES = ['draft', 'ready', 'approved', 'in_progress', 'blocked']

export async function getActiveEquivalentMission(input: {
  incidentId: string
  verificationPlanId: string
  primaryNeedId: string
  methodCode: string
  profileVersion: string
}): Promise<MissionRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('missions')
    .select('*')
    .eq('incident_id', input.incidentId)
    .eq('verification_plan_id', input.verificationPlanId)
    .eq('primary_verification_need_id', input.primaryNeedId)
    .eq('recommended_method_code', input.methodCode)
    .eq('mission_profile_version', input.profileVersion)
    .in('status', ACTIVE_STATUSES)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as MissionRow | null) ?? null
}

export async function getMissionById(id: string): Promise<MissionRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('missions').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as MissionRow | null) ?? null
}

export async function getMissionByContextSignature(
  planId: string,
  signature: string,
): Promise<MissionRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('missions')
    .select('*')
    .eq('verification_plan_id', planId)
    .eq('context_signature', signature)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as MissionRow | null) ?? null
}

export async function persistMissionBundle(
  result: MissionCreationResult & Record<string, unknown>,
): Promise<string> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  const { data: mission, error: missionError } = await supabase
    .from('missions')
    .insert({
      mission_type: result.mission_type,
      domain: 'fire',
      title: result.title,
      objective: result.objective,
      status: result.status,
      incident_id: result.incident_id,
      verification_plan_id: result.verification_plan_id,
      primary_verification_need_id: result.primary_verification_need_id,
      recommended_method_code: result.recommended_method_code,
      location_geometry: result.location_geometry ?? null,
      location_description: result.location_description ?? '',
      priority: result.priority,
      earliest_start_at: result.earliest_start_at,
      due_at: result.due_at,
      expires_at: result.expires_at,
      completion_criteria: { text: result.completion_criteria },
      inconclusive_criteria: { text: result.inconclusive_criteria },
      blocking_conditions: result.blocking_conditions ?? [],
      cancellation_conditions: result.cancellation_conditions ?? [],
      mission_profile_version: result.mission_profile_version,
      source_snapshot: {
        plan_id: result.verification_plan_id,
        eligibility: result.eligibility,
        reasons: result.reasons,
      },
      context_signature: result.context_signature,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()
  if (missionError) throw new Error(missionError.message)
  const missionId = String(mission.id)

  for (const task of result.tasks) {
    const { error } = await supabase.from('mission_tasks').insert({
      mission_id: missionId,
      task_type: task.task_type,
      sequence: task.sequence,
      title: task.title,
      instructions: task.instructions,
      status: task.status,
      required: task.required,
      completion_criteria: { text: task.completion_criteria },
    })
    if (error) throw new Error(error.message)
  }

  for (const req of result.evidence_requirements) {
    const { error } = await supabase.from('mission_evidence_requirements').insert({
      mission_id: missionId,
      verification_need_id: result.primary_verification_need_id,
      evidence_type: req.evidence_type,
      required: req.required,
      minimum_count: req.minimum_count,
      required_metadata: req.required_metadata,
      quality_criteria: req.quality_criteria,
      acceptance_criteria: { text: req.acceptance_criteria },
    })
    if (error) throw new Error(error.message)
  }

  const { error: transitionError } = await supabase.from('mission_status_transitions').insert({
    mission_id: missionId,
    from_status: 'draft',
    to_status: result.status ?? 'ready',
    reason: 'Creación automática desde plan de verificación',
    actor_type: 'system',
    actor_id: null,
    evidence_or_condition: { decision: result.decision },
    mission_profile_version: result.mission_profile_version,
    transitioned_at: now,
  })
  if (transitionError) throw new Error(transitionError.message)

  const { error: planError } = await supabase
    .from('verification_plans')
    .update({
      mission_candidate_pending: false,
      linked_mission_id: missionId,
      updated_at: now,
    })
    .eq('id', result.verification_plan_id)
  if (planError) throw new Error(planError.message)

  return missionId
}

export async function listMissions(filters: {
  status?: string
  incident_id?: string
  verification_plan_id?: string
  limit?: number
}): Promise<MissionRow[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('missions')
    .select('*')
    .order('priority', { ascending: false })
    .limit(filters.limit ?? 100)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.incident_id) query = query.eq('incident_id', filters.incident_id)
  if (filters.verification_plan_id) {
    query = query.eq('verification_plan_id', filters.verification_plan_id)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data as MissionRow[]) ?? []
}

export async function listMissionTasks(missionId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('mission_tasks')
    .select('*')
    .eq('mission_id', missionId)
    .order('sequence', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listMissionEvidenceRequirements(missionId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('mission_evidence_requirements')
    .select('*')
    .eq('mission_id', missionId)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listMissionTransitions(missionId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('mission_status_transitions')
    .select('*')
    .eq('mission_id', missionId)
    .order('transitioned_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function transitionMissionStatus(input: {
  missionId: string
  fromStatus: string
  toStatus: string
  reason: string
  actorType?: 'system' | 'user'
  actorId?: string | null
  profileVersion: string
  evidenceOrCondition?: Record<string, unknown>
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = {
    status: input.toStatus,
    updated_at: now,
  }
  if (input.toStatus === 'completed') updates.completed_at = now
  if (input.toStatus === 'cancelled') updates.cancelled_at = now

  const { error: missionError } = await supabase
    .from('missions')
    .update(updates)
    .eq('id', input.missionId)
    .eq('status', input.fromStatus)
  if (missionError) throw new Error(missionError.message)

  const { error: transitionError } = await supabase.from('mission_status_transitions').insert({
    mission_id: input.missionId,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    reason: input.reason,
    actor_type: input.actorType ?? 'system',
    actor_id: input.actorId ?? null,
    evidence_or_condition: input.evidenceOrCondition ?? {},
    mission_profile_version: input.profileVersion,
    transitioned_at: now,
  })
  if (transitionError) throw new Error(transitionError.message)
}

export async function markVerificationPlanMissionCandidate(
  planId: string,
  pending: boolean,
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('verification_plans')
    .update({ mission_candidate_pending: pending, updated_at: new Date().toISOString() })
    .eq('id', planId)
  if (error) throw new Error(error.message)
}
