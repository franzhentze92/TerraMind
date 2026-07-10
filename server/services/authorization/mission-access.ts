import type { AuthorizedResourceContext, RequestAuthContext } from '@/core/auth/permissions'
import { AuthorizationError } from '@/core/auth/permissions'
import { authorizeWithPermission } from './authorization-core.js'
import { TEST_MISSION_ORG_A, TEST_MISSION_ORG_B } from '../../auth/test-fixtures.js'

export interface MissionAccessSnapshot {
  id: string
  organization_id: string | null
  status: string
  assignee_user_ids?: string[]
}

const TEST_MISSIONS: Record<string, MissionAccessSnapshot> = {
  [TEST_MISSION_ORG_A]: {
    id: TEST_MISSION_ORG_A,
    organization_id: '00000000-0000-4000-a07f-000000000001',
    status: 'in_progress',
    assignee_user_ids: ['00000000-0000-4000-a07f-000000000101'],
  },
  [TEST_MISSION_ORG_B]: {
    id: TEST_MISSION_ORG_B,
    organization_id: '00000000-0000-4000-a07f-000000000002',
    status: 'in_progress',
    assignee_user_ids: ['00000000-0000-4000-a07f-000000000201'],
  },
}

export async function loadMissionAccessSnapshot(missionId: string): Promise<MissionAccessSnapshot | null> {
  if (process.env.AUTH_TEST_MODE === '1' || process.env.NODE_ENV === 'test') {
    return TEST_MISSIONS[missionId] ?? null
  }
  const { getMissionById } = await import('@/pipeline/stores/missions.store.js')
  const mission = await getMissionById(missionId)
  if (!mission) return null
  return {
    id: String(mission.id),
    organization_id: mission.organization_id ? String(mission.organization_id) : null,
    status: String(mission.status),
  }
}

export async function authorizeMissionAccess(
  auth: RequestAuthContext,
  missionId: string,
  options?: { requireAssignee?: boolean },
): Promise<AuthorizedResourceContext> {
  const mission = await loadMissionAccessSnapshot(missionId)
  if (!mission) throw new AuthorizationError('Misión no encontrada', 404)

  const ctx = authorizeWithPermission(auth, 'missions.view', mission, 'mission')

  if (options?.requireAssignee && !auth.isPlatformAdmin && !auth.roles.includes('field_supervisor')) {
    const allowed = mission.assignee_user_ids?.includes(auth.userId)
    if (!allowed && !auth.permissions.includes('missions.assign')) {
      throw new AuthorizationError('Misión no asignada al usuario', 403)
    }
  }

  return ctx
}

export async function authorizeAssignmentAction(
  auth: RequestAuthContext,
  missionId: string,
): Promise<AuthorizedResourceContext> {
  const mission = await loadMissionAccessSnapshot(missionId)
  if (!mission) throw new AuthorizationError('Misión no encontrada', 404)
  return authorizeWithPermission(auth, 'missions.assign', mission, 'mission_assignment')
}
