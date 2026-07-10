import type { OperationalAssignee } from '@/modules/missions/assignment/assignment.types'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export interface MissionAssignmentRow {
  id: string
  mission_id: string
  assignee_type: string
  assignee_id: string
  organization_id: string | null
  status: string
  assigned_at: string | null
  accepted_at: string | null
  declined_at: string | null
  started_at: string | null
  ended_at: string | null
  assignment_reason: string
  decline_reason: string | null
  reassignment_reason: string | null
  block_reason: string | null
  assigned_by_type: string
  assigned_by_id: string | null
  context_snapshot: Record<string, unknown>
  compatibility_snapshot: Record<string, unknown>
  idempotency_key: string | null
  workflow_version: string
  created_at: string
  updated_at: string
}

const ACTIVE_ASSIGNMENT_STATUSES = ['proposed', 'assigned', 'accepted', 'active']

export async function getOperationalAssignee(id: string): Promise<OperationalAssignee | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('operational_assignees')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapAssigneeRow(data)
}

export function mapAssigneeRow(row: Record<string, unknown>): OperationalAssignee {
  return {
    id: String(row.id),
    assignee_type: row.assignee_type as OperationalAssignee['assignee_type'],
    display_name: String(row.display_name),
    organization_id: row.organization_id ? String(row.organization_id) : null,
    coverage_zones: (row.coverage_zones as string[]) ?? [],
    capabilities: (row.capabilities as string[]) ?? [],
    allowed_mission_types: (row.allowed_mission_types as string[]) ?? [],
    max_active_missions: Number(row.max_active_missions ?? 3),
    is_available: Boolean(row.is_available),
    is_active: Boolean(row.is_active),
    permissions: (row.permissions as OperationalAssignee['permissions']) ?? [],
  }
}

export async function getActiveAssignmentForMission(
  missionId: string,
): Promise<MissionAssignmentRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('mission_assignments')
    .select('*')
    .eq('mission_id', missionId)
    .in('status', ACTIVE_ASSIGNMENT_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as MissionAssignmentRow | null) ?? null
}

export async function countActiveAssignmentsForAssignee(
  assigneeType: string,
  assigneeId: string,
): Promise<number> {
  const supabase = getSupabaseAdmin()
  const { count, error } = await supabase
    .from('mission_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('assignee_type', assigneeType)
    .eq('assignee_id', assigneeId)
    .in('status', ACTIVE_ASSIGNMENT_STATUSES)
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function listAssignmentsForMission(missionId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('mission_assignments')
    .select('*')
    .eq('mission_id', missionId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as MissionAssignmentRow[]) ?? []
}

export async function listAssignmentHistory(missionId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('mission_assignment_history')
    .select('*')
    .eq('mission_id', missionId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listMissionsForAssignee(assigneeType: string, assigneeId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('mission_assignments')
    .select('*, missions(*)')
    .eq('assignee_type', assigneeType)
    .eq('assignee_id', assigneeId)
    .order('updated_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function closeAssignment(input: {
  assignmentId: string
  toStatus: string
  reason?: string
  endedAt?: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = input.endedAt ?? new Date().toISOString()
  const { error } = await supabase
    .from('mission_assignments')
    .update({
      status: input.toStatus,
      ended_at: now,
      decline_reason: input.toStatus === 'declined' ? input.reason : undefined,
      updated_at: now,
    })
    .eq('id', input.assignmentId)
  if (error) throw new Error(error.message)
}

export async function insertAssignment(input: {
  missionId: string
  assigneeType: string
  assigneeId: string
  organizationId: string | null
  status: string
  reason: string
  assignedByType: string
  assignedById: string | null
  compatibilitySnapshot: Record<string, unknown>
  idempotencyKey?: string
  workflowVersion: string
}): Promise<string> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('mission_assignments')
    .insert({
      mission_id: input.missionId,
      assignee_type: input.assigneeType,
      assignee_id: input.assigneeId,
      organization_id: input.organizationId,
      status: input.status,
      assigned_at: now,
      assignment_reason: input.reason,
      assigned_by_type: input.assignedByType,
      assigned_by_id: input.assignedById,
      compatibility_snapshot: input.compatibilitySnapshot,
      idempotency_key: input.idempotencyKey ?? null,
      workflow_version: input.workflowVersion,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return String(data.id)
}

export async function updateAssignmentStatus(input: {
  assignmentId: string
  fromStatus: string
  toStatus: string
  patch?: Record<string, unknown>
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('mission_assignments')
    .update({ status: input.toStatus, updated_at: now, ...input.patch })
    .eq('id', input.assignmentId)
    .eq('status', input.fromStatus)
  if (error) throw new Error(error.message)
}

export async function recordAssignmentHistory(input: {
  missionId: string
  assignmentId: string | null
  action: string
  fromStatus: string | null
  toStatus: string | null
  reason: string
  actorType: string
  actorId: string | null
  payload?: Record<string, unknown>
  workflowVersion: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('mission_assignment_history').insert({
    mission_id: input.missionId,
    assignment_id: input.assignmentId,
    action: input.action,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    reason: input.reason,
    actor_type: input.actorType,
    actor_id: input.actorId,
    payload: input.payload ?? {},
    workflow_version: input.workflowVersion,
  })
  if (error) throw new Error(error.message)
}

export async function recordWorkflowTransition(input: {
  missionId: string
  assignmentId: string | null
  action: string
  missionFrom: string | null
  missionTo: string | null
  assignmentFrom: string | null
  assignmentTo: string | null
  reason: string
  actorType: string
  actorId: string | null
  payload?: Record<string, unknown>
  workflowVersion: string
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('mission_workflow_transitions').insert({
    mission_id: input.missionId,
    assignment_id: input.assignmentId,
    action: input.action,
    mission_from_status: input.missionFrom,
    mission_to_status: input.missionTo,
    assignment_from_status: input.assignmentFrom,
    assignment_to_status: input.assignmentTo,
    reason: input.reason,
    actor_type: input.actorType,
    actor_id: input.actorId,
    payload: input.payload ?? {},
    workflow_version: input.workflowVersion,
    transitioned_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export async function recordAssignmentEvaluationRun(input: {
  missionId: string
  assignmentId: string | null
  action: string
  idempotencyKey?: string
  decision: string
  warnings?: string[]
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('mission_assignment_evaluation_runs').insert({
    mission_id: input.missionId,
    assignment_id: input.assignmentId,
    action: input.action,
    idempotency_key: input.idempotencyKey ?? null,
    decision: input.decision,
    warnings: input.warnings ?? [],
    evaluated_at: new Date().toISOString(),
  })
  if (error) {
    if (error.code === '23505') return
    throw new Error(error.message)
  }
}
