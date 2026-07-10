import type { RequestAuthContext } from '@/core/auth/permissions'
import {
  evaluateWorkflowCommand,
  MISSION_WORKFLOW_VERSION,
} from '@/modules/missions/assignment/mission-workflow.engine'
import type { WorkflowCommand, WorkflowResult } from '@/modules/missions/assignment/assignment.types'
import { ALL_MISSION_PERMISSIONS } from '@/modules/missions/config/fire-assignment.config'
import {
  closeAssignment,
  countActiveAssignmentsForAssignee,
  getActiveAssignmentForMission,
  getOperationalAssignee,
  insertAssignment,
  recordAssignmentEvaluationRun,
  recordAssignmentHistory,
  recordWorkflowTransition,
  updateAssignmentStatus,
} from '@/pipeline/stores/mission-assignments.store'
import {
  getMissionById,
  listMissionTasks,
  transitionMissionStatus,
} from '@/pipeline/stores/missions.store'
import { FIRE_MISSION_PROFILE_VERSION } from '@/modules/missions/config/fire-mission.config'

function defaultActor(auth: { userId: string; permissions: string[] } | null, actorId?: string | null) {
  if (auth) {
    return {
      actor_type: 'user' as const,
      actor_id: auth.userId,
      permissions: ALL_MISSION_PERMISSIONS.filter((p) =>
        auth.permissions.includes(p as never),
      ) as typeof ALL_MISSION_PERMISSIONS,
    }
  }
  if (actorId) {
    return {
      actor_type: 'user' as const,
      actor_id: actorId,
      permissions: ALL_MISSION_PERMISSIONS,
    }
  }
  throw new Error('actor_authentication_required')
}

export async function executeMissionWorkflow(
  missionId: string,
  command: Omit<WorkflowCommand, 'mission_id' | 'actor'> & {
    actor_id?: string | null
    actor_permissions?: WorkflowCommand['actor']['permissions']
  },
  auth?: RequestAuthContext | null,
): Promise<WorkflowResult> {
  const mission = await getMissionById(missionId)
  if (!mission) throw new Error('Misión no encontrada')

  const assignment = await getActiveAssignmentForMission(missionId)
  const tasks = await listMissionTasks(missionId)
  const requiredPending = tasks.filter((t) => t.required && t.status !== 'completed').length

  let assignee = null
  let activeCount = 0
  if (command.assignee_id) {
    assignee = await getOperationalAssignee(command.assignee_id)
    if (!assignee) throw new Error('Ejecutor no encontrado')
    activeCount = await countActiveAssignmentsForAssignee(
      command.assignee_type ?? assignee.assignee_type,
      command.assignee_id,
    )
  } else if (assignment) {
    assignee = await getOperationalAssignee(assignment.assignee_id)
    activeCount = await countActiveAssignmentsForAssignee(
      assignment.assignee_type,
      assignment.assignee_id,
    )
  }

  const actorPreview = defaultActor(auth ?? null, command.actor_id)

  const evaluation = evaluateWorkflowCommand({
    command: {
      ...command,
      mission_id: missionId,
      actor: {
        actor_type: 'user',
        actor_id: actorPreview.actor_id,
        permissions: command.actor_permissions ?? actorPreview.permissions,
      },
    },
    mission: {
      id: mission.id,
      status: mission.status as WorkflowResult['mission_status'],
      mission_type: mission.mission_type,
      recommended_method_code: mission.recommended_method_code,
      expires_at: mission.expires_at,
      due_at: mission.due_at,
      required_tasks_pending: requiredPending,
    },
    assignment: assignment
      ? {
          id: assignment.id,
          status: assignment.status as WorkflowResult['assignment_status'] & string,
          assignee_type: assignment.assignee_type,
          assignee_id: assignment.assignee_id,
          idempotency_key: assignment.idempotency_key,
        }
      : null,
    assignee: assignee ?? undefined,
    assignee_active_count: activeCount,
    now_iso: new Date().toISOString(),
  })

  await recordAssignmentEvaluationRun({
    missionId,
    assignmentId: assignment?.id ?? null,
    action: command.action,
    idempotencyKey: command.idempotency_key,
    decision: evaluation.ok ? 'allowed' : 'rejected',
    warnings: evaluation.warnings,
  })

  if (!evaluation.ok || evaluation.idempotent_replay) return evaluation

  const actor = defaultActor(auth ?? null, command.actor_id)
  let assignmentId = assignment?.id ?? null

  if (evaluation.close_assignment && assignment) {
    await closeAssignment({
      assignmentId: assignment.id,
      toStatus: evaluation.next_assignment_status ?? 'released',
      reason: command.reason,
    })
    await recordAssignmentHistory({
      missionId,
      assignmentId: assignment.id,
      action: command.action,
      fromStatus: assignment.status,
      toStatus: evaluation.next_assignment_status ?? 'released',
      reason: command.reason ?? evaluation.reasons[0] ?? '',
      actorType: actor.actor_type,
      actorId: actor.actor_id,
      workflowVersion: MISSION_WORKFLOW_VERSION,
    })
    assignmentId = null
  }

  if (evaluation.create_assignment && command.assignee_id && command.assignee_type) {
    assignmentId = await insertAssignment({
      missionId,
      assigneeType: command.assignee_type,
      assigneeId: command.assignee_id,
      organizationId: command.organization_id ?? assignee?.organization_id ?? null,
      status: evaluation.next_assignment_status ?? 'assigned',
      reason: command.reason ?? evaluation.reasons[0] ?? '',
      assignedByType: actor.actor_type,
      assignedById: actor.actor_id,
      compatibilitySnapshot: { ok: true },
      idempotencyKey: command.idempotency_key,
      workflowVersion: MISSION_WORKFLOW_VERSION,
    })
    await recordAssignmentHistory({
      missionId,
      assignmentId,
      action: command.action,
      fromStatus: null,
      toStatus: evaluation.next_assignment_status ?? 'assigned',
      reason: command.reason ?? evaluation.reasons[0] ?? '',
      actorType: actor.actor_type,
      actorId: actor.actor_id,
      workflowVersion: MISSION_WORKFLOW_VERSION,
    })
  } else if (evaluation.next_assignment_status && assignmentId && assignment) {
    const patch: Record<string, unknown> = {}
    if (command.action === 'accept') patch.accepted_at = new Date().toISOString()
    if (command.action === 'start') patch.started_at = new Date().toISOString()
    if (command.action === 'block') patch.block_reason = command.reason
    if (['complete', 'cancel', 'decline'].includes(command.action)) {
      patch.ended_at = new Date().toISOString()
    }
    await updateAssignmentStatus({
      assignmentId,
      fromStatus: assignment.status,
      toStatus: evaluation.next_assignment_status,
      patch,
    })
    await recordAssignmentHistory({
      missionId,
      assignmentId,
      action: command.action,
      fromStatus: assignment.status,
      toStatus: evaluation.next_assignment_status,
      reason: command.reason ?? evaluation.reasons[0] ?? '',
      actorType: actor.actor_type,
      actorId: actor.actor_id,
      workflowVersion: MISSION_WORKFLOW_VERSION,
    })
  }

  if (evaluation.next_mission_status && evaluation.next_mission_status !== mission.status) {
    await transitionMissionStatus({
      missionId,
      fromStatus: mission.status,
      toStatus: evaluation.next_mission_status,
      reason: command.reason ?? evaluation.reasons[0] ?? '',
      actorType: actor.actor_type,
      actorId: actor.actor_id,
      profileVersion: FIRE_MISSION_PROFILE_VERSION,
      evidenceOrCondition: { action: command.action },
    })
    await recordWorkflowTransition({
      missionId,
      assignmentId,
      action: command.action,
      missionFrom: mission.status,
      missionTo: evaluation.next_mission_status,
      assignmentFrom: assignment?.status ?? null,
      assignmentTo: evaluation.next_assignment_status ?? null,
      reason: command.reason ?? evaluation.reasons[0] ?? '',
      actorType: actor.actor_type,
      actorId: actor.actor_id,
      workflowVersion: MISSION_WORKFLOW_VERSION,
    })
  }

  return {
    ...evaluation,
    assignment_id: assignmentId,
    mission_status: evaluation.next_mission_status ?? mission.status,
    assignment_status: evaluation.next_assignment_status ?? null,
  }
}

export async function getMissionAssignmentsDto(missionId: string) {
  const { listAssignmentsForMission, listAssignmentHistory } = await import(
    '@/pipeline/stores/mission-assignments.store'
  )
  return {
    assignments: await listAssignmentsForMission(missionId),
    history: await listAssignmentHistory(missionId),
    generated_at: new Date().toISOString(),
  }
}

export async function getAssigneeMissionsDto(assigneeType: string, assigneeId: string) {
  const { listMissionsForAssignee } = await import('@/pipeline/stores/mission-assignments.store')
  return {
    items: await listMissionsForAssignee(assigneeType, assigneeId),
    generated_at: new Date().toISOString(),
  }
}
