import { describe, expect, it } from 'vitest'

import { evaluateAssigneeCompatibility } from '@/modules/missions/assignment/assignee-compatibility.engine'
import { assertMissionPermission } from '@/modules/missions/assignment/mission-permissions'
import { evaluateWorkflowCommand } from '@/modules/missions/assignment/mission-workflow.engine'
import type { WorkflowMissionState } from '@/modules/missions/assignment/mission-workflow.engine'
import { SYNTHETIC_ASSIGNEES, ALL_MISSION_PERMISSIONS } from '@/modules/missions/config/fire-assignment.config'

const NOW = '2026-07-10T20:00:00.000Z'

function mission(overrides: Partial<WorkflowMissionState> = {}): WorkflowMissionState {
  return {
    id: 'mission-1',
    status: 'ready',
    mission_type: 'field_visual_inspection',
    recommended_method_code: 'field_visual_inspection',
    expires_at: '2026-07-11T20:00:00.000Z',
    due_at: '2026-07-11T12:00:00.000Z',
    required_tasks_pending: 3,
    ...overrides,
  }
}

const actor = {
  actor_type: 'user' as const,
  actor_id: 'fixture-field-inspector',
  permissions: ALL_MISSION_PERMISSIONS,
}

describe('mission assignment workflow', () => {
  it('assigns compatible assignee to ready mission', () => {
    const result = evaluateWorkflowCommand({
      command: {
        action: 'assign',
        mission_id: 'mission-1',
        assignee_type: 'user',
        assignee_id: SYNTHETIC_ASSIGNEES.field_inspector.id,
        actor,
      },
      mission: mission(),
      assignment: null,
      assignee: SYNTHETIC_ASSIGNEES.field_inspector,
      assignee_active_count: 0,
      now_iso: NOW,
    })
    expect(result.ok).toBe(true)
    expect(result.next_mission_status).toBe('assigned')
    expect(result.next_assignment_status).toBe('assigned')
  })

  it('rejects incompatible assignee', () => {
    const result = evaluateWorkflowCommand({
      command: {
        action: 'assign',
        mission_id: 'mission-1',
        assignee_type: 'external_actor',
        assignee_id: SYNTHETIC_ASSIGNEES.incompatible_actor.id,
        actor,
      },
      mission: mission(),
      assignment: null,
      assignee: SYNTHETIC_ASSIGNEES.incompatible_actor,
      assignee_active_count: 0,
      now_iso: NOW,
    })
    expect(result.ok).toBe(false)
  })

  it('allows override with permission', () => {
    const result = evaluateWorkflowCommand({
      command: {
        action: 'assign',
        mission_id: 'mission-1',
        assignee_type: 'external_actor',
        assignee_id: SYNTHETIC_ASSIGNEES.incompatible_actor.id,
        override_compatibility: true,
        actor,
      },
      mission: mission(),
      assignment: null,
      assignee: SYNTHETIC_ASSIGNEES.incompatible_actor,
      assignee_active_count: 0,
      now_iso: NOW,
    })
    expect(result.ok).toBe(true)
  })

  it('assign does not equal accept', () => {
    const assigned = evaluateWorkflowCommand({
      command: {
        action: 'assign',
        mission_id: 'mission-1',
        assignee_type: 'user',
        assignee_id: SYNTHETIC_ASSIGNEES.field_inspector.id,
        actor,
      },
      mission: mission({ status: 'ready' }),
      assignment: null,
      assignee: SYNTHETIC_ASSIGNEES.field_inspector,
      now_iso: NOW,
    })
    expect(assigned.ok).toBe(true)
    expect(assigned.next_assignment_status).toBe('assigned')

    const accepted = evaluateWorkflowCommand({
      command: {
        action: 'accept',
        mission_id: 'mission-1',
        actor: { ...actor, actor_id: SYNTHETIC_ASSIGNEES.field_inspector.id },
      },
      mission: mission({ status: 'assigned' }),
      assignment: {
        id: 'a1',
        status: 'assigned',
        assignee_type: 'user',
        assignee_id: SYNTHETIC_ASSIGNEES.field_inspector.id,
        idempotency_key: null,
      },
      now_iso: NOW,
    })
    expect(accepted.next_assignment_status).toBe('accepted')
  })

  it('decline leaves mission available for reassignment', () => {
    const result = evaluateWorkflowCommand({
      command: {
        action: 'decline',
        mission_id: 'mission-1',
        reason: 'No disponible en ventana',
        actor,
      },
      mission: mission({ status: 'assigned' }),
      assignment: {
        id: 'a1',
        status: 'assigned',
        assignee_type: 'user',
        assignee_id: SYNTHETIC_ASSIGNEES.field_inspector.id,
        idempotency_key: null,
      },
      now_iso: NOW,
    })
    expect(result.ok).toBe(true)
    expect(result.next_mission_status).toBe('approved')
    expect(result.next_assignment_status).toBe('declined')
  })

  it('cannot start without acceptance', () => {
    const result = evaluateWorkflowCommand({
      command: { action: 'start', mission_id: 'mission-1', actor },
      mission: mission({ status: 'assigned' }),
      assignment: {
        id: 'a1',
        status: 'assigned',
        assignee_type: 'user',
        assignee_id: SYNTHETIC_ASSIGNEES.field_inspector.id,
        idempotency_key: null,
      },
      now_iso: NOW,
    })
    expect(result.ok).toBe(false)
  })

  it('starts accepted mission', () => {
    const result = evaluateWorkflowCommand({
      command: { action: 'start', mission_id: 'mission-1', actor },
      mission: mission({ status: 'assigned' }),
      assignment: {
        id: 'a1',
        status: 'accepted',
        assignee_type: 'user',
        assignee_id: SYNTHETIC_ASSIGNEES.field_inspector.id,
        idempotency_key: null,
      },
      now_iso: NOW,
    })
    expect(result.ok).toBe(true)
    expect(result.next_mission_status).toBe('in_progress')
    expect(result.next_assignment_status).toBe('active')
  })

  it('cannot start expired mission', () => {
    const result = evaluateWorkflowCommand({
      command: { action: 'start', mission_id: 'mission-1', actor },
      mission: mission({
        status: 'assigned',
        expires_at: '2026-07-09T20:00:00.000Z',
      }),
      assignment: {
        id: 'a1',
        status: 'accepted',
        assignee_type: 'user',
        assignee_id: SYNTHETIC_ASSIGNEES.field_inspector.id,
        idempotency_key: null,
      },
      now_iso: NOW,
    })
    expect(result.ok).toBe(false)
  })

  it('block requires reason', () => {
    const result = evaluateWorkflowCommand({
      command: { action: 'block', mission_id: 'mission-1', actor },
      mission: mission({ status: 'in_progress' }),
      assignment: {
        id: 'a1',
        status: 'active',
        assignee_type: 'user',
        assignee_id: SYNTHETIC_ASSIGNEES.field_inspector.id,
        idempotency_key: null,
      },
      now_iso: NOW,
    })
    expect(result.ok).toBe(false)
    const ok = evaluateWorkflowCommand({
      command: {
        action: 'block',
        mission_id: 'mission-1',
        reason: 'Acceso restringido',
        actor,
      },
      mission: mission({ status: 'in_progress' }),
      assignment: {
        id: 'a1',
        status: 'active',
        assignee_type: 'user',
        assignee_id: SYNTHETIC_ASSIGNEES.field_inspector.id,
        idempotency_key: null,
      },
      now_iso: NOW,
    })
    expect(ok.ok).toBe(true)
  })

  it('complete does not auto-validate evidence', () => {
    const result = evaluateWorkflowCommand({
      command: { action: 'complete', mission_id: 'mission-1', actor },
      mission: mission({ status: 'in_progress', required_tasks_pending: 2 }),
      assignment: {
        id: 'a1',
        status: 'active',
        assignee_type: 'user',
        assignee_id: SYNTHETIC_ASSIGNEES.field_inspector.id,
        idempotency_key: null,
      },
      now_iso: NOW,
    })
    expect(result.ok).toBe(false)
    const inconclusive = evaluateWorkflowCommand({
      command: {
        action: 'complete',
        mission_id: 'mission-1',
        explicit_inconclusive: true,
        reason: 'Visibilidad limitada',
        actor,
      },
      mission: mission({ status: 'in_progress', required_tasks_pending: 2 }),
      assignment: {
        id: 'a1',
        status: 'active',
        assignee_type: 'user',
        assignee_id: SYNTHETIC_ASSIGNEES.field_inspector.id,
        idempotency_key: null,
      },
      now_iso: NOW,
    })
    expect(inconclusive.ok).toBe(true)
    expect(inconclusive.next_mission_status).toBe('inconclusive')
    expect(inconclusive.warnings).toContain('Completar no valida evidencia automáticamente')
  })

  it('cancel closes active assignment', () => {
    const result = evaluateWorkflowCommand({
      command: {
        action: 'cancel',
        mission_id: 'mission-1',
        reason: 'Plan superseded',
        actor,
      },
      mission: mission({ status: 'assigned' }),
      assignment: {
        id: 'a1',
        status: 'accepted',
        assignee_type: 'user',
        assignee_id: SYNTHETIC_ASSIGNEES.field_inspector.id,
        idempotency_key: null,
      },
      now_iso: NOW,
    })
    expect(result.ok).toBe(true)
    expect(result.next_mission_status).toBe('cancelled')
    expect(result.next_assignment_status).toBe('cancelled')
  })

  it('rejects action without permission', () => {
    expect(() =>
      assertMissionPermission(['missions.accept'], 'assign'),
    ).toThrow()
  })

  it('idempotent replay detected', () => {
    const result = evaluateWorkflowCommand({
      command: {
        action: 'accept',
        mission_id: 'mission-1',
        idempotency_key: 'key-1',
        actor: { ...actor, actor_id: SYNTHETIC_ASSIGNEES.field_inspector.id },
      },
      mission: mission({ status: 'assigned' }),
      assignment: {
        id: 'a1',
        status: 'assigned',
        assignee_type: 'user',
        assignee_id: SYNTHETIC_ASSIGNEES.field_inspector.id,
        idempotency_key: 'key-1',
      },
      now_iso: NOW,
    })
    expect(result.idempotent_replay).toBe(true)
  })

  it('rejects overloaded assignee', () => {
    const compat = evaluateAssigneeCompatibility({
      assignee: SYNTHETIC_ASSIGNEES.overloaded_actor,
      mission_type: 'field_visual_inspection',
      recommended_method_code: 'field_visual_inspection',
      active_mission_count: 0,
      mission_expired: false,
    })
    expect(compat.compatible).toBe(false)
  })
})
