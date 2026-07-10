import { evaluateAssigneeCompatibility } from '@/modules/missions/assignment/assignee-compatibility.engine'
import { assertMissionPermission } from '@/modules/missions/assignment/mission-permissions'
import type {
  AssignmentStatus,
  OperationalAssignee,
  WorkflowCommand,
  WorkflowResult,
} from '@/modules/missions/assignment/assignment.types'
import { MISSION_WORKFLOW_VERSION } from '@/modules/missions/config/fire-assignment.config'
import {
  assertValidMissionTransition,
  canCompleteMission,
} from '@/modules/missions/engine/mission-state-machine'
import type { MissionStatus } from '@/modules/missions/missions.types'

export interface WorkflowMissionState {
  id: string
  status: MissionStatus
  mission_type: string
  recommended_method_code: string
  expires_at: string
  due_at: string
  required_tasks_pending: number
}

export interface WorkflowAssignmentState {
  id: string
  status: AssignmentStatus
  assignee_type: string
  assignee_id: string
  idempotency_key: string | null
}

export interface WorkflowEvaluationInput {
  command: WorkflowCommand
  mission: WorkflowMissionState
  assignment: WorkflowAssignmentState | null
  assignee?: OperationalAssignee
  assignee_active_count?: number
  now_iso: string
}

function isExpired(expiresAt: string, nowIso: string): boolean {
  return Date.parse(expiresAt) < Date.parse(nowIso)
}

function fail(action: string, reasons: string[], warnings: string[] = []): WorkflowResult {
  return {
    ok: false,
    action,
    mission_status: '',
    assignment_status: null,
    assignment_id: null,
    reasons,
    warnings,
    idempotent_replay: false,
  }
}

export function evaluateWorkflowCommand(input: WorkflowEvaluationInput): WorkflowResult & {
  next_mission_status?: MissionStatus
  next_assignment_status?: AssignmentStatus
  close_assignment?: boolean
  create_assignment?: boolean
} {
  const { command, mission, assignment } = input
  const expired = isExpired(mission.expires_at, input.now_iso)

  try {
    assertMissionPermission(
      command.actor.permissions,
      command.action,
      command.override_compatibility,
    )
  } catch (err) {
    return fail(command.action, [err instanceof Error ? err.message : 'Permiso denegado'])
  }

  if (command.idempotency_key && assignment?.idempotency_key === command.idempotency_key) {
    return {
      ok: true,
      action: command.action,
      mission_status: mission.status,
      assignment_status: assignment.status,
      assignment_id: assignment.id,
      reasons: ['Operación idempotente ya aplicada'],
      warnings: [],
      idempotent_replay: true,
    }
  }

  switch (command.action) {
    case 'assign': {
      if (!command.assignee_type || !command.assignee_id || !input.assignee) {
        return fail('assign', ['assignee_type y assignee_id son requeridos'])
      }
      if (!['ready', 'approved'].includes(mission.status)) {
        return fail('assign', [`Misión en estado ${mission.status}; no asignable`])
      }
      if (assignment && ['assigned', 'accepted', 'active'].includes(assignment.status)) {
        return fail('assign', ['Ya existe una asignación activa'])
      }
      const compat = evaluateAssigneeCompatibility({
        assignee: input.assignee,
        mission_type: mission.mission_type,
        recommended_method_code: mission.recommended_method_code,
        active_mission_count: input.assignee_active_count ?? 0,
        mission_expired: expired,
      })
      if (!compat.compatible && !command.override_compatibility) {
        return fail('assign', compat.reasons, compat.limitations)
      }
      const nextMission: MissionStatus = mission.status === 'ready' ? 'assigned' : 'assigned'
      assertValidMissionTransition(mission.status, nextMission)
      return {
        ok: true,
        action: 'assign',
        mission_status: nextMission,
        assignment_status: 'assigned',
        assignment_id: null,
        reasons: ['Asignación registrada; requiere aceptación del ejecutor'],
        warnings: compat.limitations,
        idempotent_replay: false,
        next_mission_status: nextMission,
        next_assignment_status: 'assigned',
        create_assignment: true,
      }
    }

    case 'accept': {
      if (!assignment || assignment.status !== 'assigned') {
        return fail('accept', ['No hay asignación pendiente de aceptación'])
      }
      if (command.actor.actor_id && command.actor.actor_id !== assignment.assignee_id) {
        return fail('accept', ['Solo el ejecutor asignado puede aceptar'])
      }
      return {
        ok: true,
        action: 'accept',
        mission_status: mission.status,
        assignment_status: 'accepted',
        assignment_id: assignment.id,
        reasons: ['Asignación aceptada'],
        warnings: [],
        idempotent_replay: false,
        next_assignment_status: 'accepted',
      }
    }

    case 'decline': {
      if (!assignment || !['assigned', 'accepted'].includes(assignment.status)) {
        return fail('decline', ['No hay asignación declinable'])
      }
      if (!command.reason) return fail('decline', ['Motivo de rechazo requerido'])
      const nextMission: MissionStatus =
        mission.status === 'assigned' ? 'approved' : mission.status
      return {
        ok: true,
        action: 'decline',
        mission_status: nextMission,
        assignment_status: 'declined',
        assignment_id: assignment.id,
        reasons: ['Asignación rechazada; misión disponible para reasignación'],
        warnings: [],
        idempotent_replay: false,
        next_mission_status: nextMission,
        next_assignment_status: 'declined',
        close_assignment: true,
      }
    }

    case 'reassign': {
      if (!command.assignee_type || !command.assignee_id || !input.assignee) {
        return fail('reassign', ['Nuevo ejecutor requerido'])
      }
      if (mission.status === 'cancelled' || mission.status === 'expired') {
        return fail('reassign', ['Misión no reasignable'])
      }
      if (assignment && assignment.status === 'active') {
        return fail('reassign', ['Cierre la asignación activa antes de reasignar en progreso'])
      }
      if (!command.reason) return fail('reassign', ['Motivo de reasignación requerido'])
      const compat = evaluateAssigneeCompatibility({
        assignee: input.assignee,
        mission_type: mission.mission_type,
        recommended_method_code: mission.recommended_method_code,
        active_mission_count: input.assignee_active_count ?? 0,
        mission_expired: expired,
      })
      if (!compat.compatible && !command.override_compatibility) {
        return fail('reassign', compat.reasons)
      }
      return {
        ok: true,
        action: 'reassign',
        mission_status: 'assigned',
        assignment_status: 'assigned',
        assignment_id: null,
        reasons: ['Reasignación registrada'],
        warnings: [],
        idempotent_replay: false,
        next_mission_status: 'assigned',
        next_assignment_status: 'assigned',
        close_assignment: Boolean(assignment),
        create_assignment: true,
      }
    }

    case 'start': {
      if (expired) return fail('start', ['Misión expirada'])
      if (!assignment || assignment.status !== 'accepted') {
        return fail('start', ['La misión debe estar aceptada antes de iniciar'])
      }
      if (!['assigned', 'approved'].includes(mission.status)) {
        return fail('start', [`Estado de misión incompatible: ${mission.status}`])
      }
      assertValidMissionTransition(mission.status, 'in_progress')
      return {
        ok: true,
        action: 'start',
        mission_status: 'in_progress',
        assignment_status: 'active',
        assignment_id: assignment.id,
        reasons: ['Misión iniciada'],
        warnings: [],
        idempotent_replay: false,
        next_mission_status: 'in_progress',
        next_assignment_status: 'active',
      }
    }

    case 'block': {
      if (mission.status !== 'in_progress') return fail('block', ['Solo misiones en progreso'])
      if (!command.reason) return fail('block', ['Motivo de bloqueo requerido'])
      assertValidMissionTransition('in_progress', 'blocked')
      return {
        ok: true,
        action: 'block',
        mission_status: 'blocked',
        assignment_status: assignment?.status ?? null,
        assignment_id: assignment?.id ?? null,
        reasons: ['Misión bloqueada'],
        warnings: [],
        idempotent_replay: false,
        next_mission_status: 'blocked',
      }
    }

    case 'resume': {
      if (mission.status !== 'blocked') return fail('resume', ['Misión no bloqueada'])
      assertValidMissionTransition('blocked', 'in_progress')
      return {
        ok: true,
        action: 'resume',
        mission_status: 'in_progress',
        assignment_status: assignment?.status ?? null,
        assignment_id: assignment?.id ?? null,
        reasons: ['Misión reanudada'],
        warnings: [],
        idempotent_replay: false,
        next_mission_status: 'in_progress',
      }
    }

    case 'complete': {
      const check = canCompleteMission({
        status: mission.status,
        requiredTasksPending: mission.required_tasks_pending,
        explicitInconclusive: Boolean(command.explicit_inconclusive),
      })
      if (!check.allowed && !command.explicit_inconclusive) {
        return fail('complete', [check.reason])
      }
      const target: MissionStatus = command.explicit_inconclusive ? 'inconclusive' : 'completed'
      assertValidMissionTransition(mission.status, target)
      return {
        ok: true,
        action: 'complete',
        mission_status: target,
        assignment_status: 'completed',
        assignment_id: assignment?.id ?? null,
        reasons: [
          target === 'inconclusive'
            ? 'Misión cerrada como inconclusa'
            : 'Misión completada operacionalmente',
        ],
        warnings: ['Completar no valida evidencia automáticamente'],
        idempotent_replay: false,
        next_mission_status: target,
        next_assignment_status: assignment ? 'completed' : undefined,
        close_assignment: Boolean(assignment),
      }
    }

    case 'cancel': {
      if (['completed', 'cancelled', 'expired'].includes(mission.status)) {
        return fail('cancel', ['Misión no cancelable'])
      }
      if (!command.reason) return fail('cancel', ['Motivo de cancelación requerido'])
      return {
        ok: true,
        action: 'cancel',
        mission_status: 'cancelled',
        assignment_status: 'cancelled',
        assignment_id: assignment?.id ?? null,
        reasons: ['Misión cancelada'],
        warnings: [],
        idempotent_replay: false,
        next_mission_status: 'cancelled',
        next_assignment_status: assignment ? 'cancelled' : undefined,
        close_assignment: Boolean(assignment),
      }
    }

    default:
      return fail(command.action, ['Acción no soportada'])
  }
}

export { MISSION_WORKFLOW_VERSION }
