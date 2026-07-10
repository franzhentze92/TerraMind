import type { RequestAuthContext } from '@/core/auth/permissions'
import { AuthorizationError } from '@/core/auth/permissions'
import {
  loadEvidenceSubmissionSnapshot,
  loadOfflinePackageSnapshot,
  loadTaskSnapshot,
  loadVerificationNeedSnapshot,
} from '../services/authorization/resource-resolver.js'
import { loadMissionAccessSnapshot } from '../services/authorization/mission-access.js'

export async function assertMissionTaskBelongsToMission(
  auth: RequestAuthContext,
  missionId: string,
  taskId: string | null | undefined,
): Promise<void> {
  if (!taskId) return
  const task = await loadTaskSnapshot(taskId)
  if (!task?.mission_id || task.mission_id !== missionId) {
    throw new AuthorizationError('Tarea no pertenece a la misión', 403)
  }
  if (task.organization_id && task.organization_id !== auth.activeOrganizationId && !auth.isPlatformAdmin) {
    throw new AuthorizationError('Acceso cross-tenant denegado', 403)
  }
}

export async function assertVerificationNeedInMissionContext(
  auth: RequestAuthContext,
  missionId: string,
  needId: string | null | undefined,
): Promise<void> {
  if (!needId) return
  const need = await loadVerificationNeedSnapshot(needId)
  if (!need) throw new AuthorizationError('Need no encontrado', 404)
  if (need.organization_id && need.organization_id !== auth.activeOrganizationId && !auth.isPlatformAdmin) {
    throw new AuthorizationError('Acceso cross-tenant denegado', 403)
  }
  const mission = await loadMissionAccessSnapshot(missionId)
  if (!mission) throw new AuthorizationError('Misión no encontrada', 404)
}

export async function assertSubmissionBelongsToTenant(
  auth: RequestAuthContext,
  submissionId: string,
): Promise<{ mission_id: string }> {
  const submission = await loadEvidenceSubmissionSnapshot(submissionId)
  if (!submission?.mission_id) throw new AuthorizationError('Submission no encontrada', 404)
  if (
    submission.organization_id &&
    submission.organization_id !== auth.activeOrganizationId &&
    !auth.isPlatformAdmin
  ) {
    throw new AuthorizationError('Acceso cross-tenant denegado', 403)
  }
  return { mission_id: submission.mission_id }
}

export async function assertPackageBelongsToMission(
  auth: RequestAuthContext,
  missionId: string,
  packageId: string | null | undefined,
): Promise<void> {
  if (!packageId) return
  const pkg = await loadOfflinePackageSnapshot(packageId)
  if (!pkg) throw new AuthorizationError('Paquete no encontrado', 404)
  if (pkg.mission_id && pkg.mission_id !== missionId) {
    throw new AuthorizationError('Paquete no pertenece a la misión', 403)
  }
  if (pkg.organization_id && pkg.organization_id !== auth.activeOrganizationId && !auth.isPlatformAdmin) {
    throw new AuthorizationError('Acceso cross-tenant denegado', 403)
  }
}

export async function assertBodyOrganizationMatchesActive(
  auth: RequestAuthContext,
  organizationId: string | null | undefined,
): Promise<void> {
  if (!organizationId) return
  if (organizationId !== auth.activeOrganizationId && !auth.isPlatformAdmin) {
    throw new AuthorizationError('organization_id del payload no coincide con la organización activa', 403)
  }
}
